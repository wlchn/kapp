package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/kapp-staging/kapp/api/client"
	"github.com/kapp-staging/kapp/api/utils"
	"github.com/labstack/echo/v4"
	log "github.com/sirupsen/logrus"
	"io"
	coreV1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/client-go/tools/remotecommand"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

type WSConn struct {
	*websocket.Conn
	ctx      context.Context
	stopFunc context.CancelFunc

	K8sClient *kubernetes.Clientset
	K8sConfig *rest.Config

	IsAuthorized       bool
	podResourceRequest chan *WSPodResourceRequest
	writeLock          *sync.Mutex
}

func (conn *WSConn) WriteJSON(v interface{}) error {
	conn.writeLock.Lock()
	defer conn.writeLock.Unlock()
	return conn.Conn.WriteJSON(v)
}

type WSRequestType string

const (
	// common auth flow
	WSRequestTypeAuth       WSRequestType = "auth"
	WSRequestTypeAuthStatus WSRequestType = "authStatus"

	// log
	WSRequestTypeSubscribePodLog   WSRequestType = "subscribePodLog"
	WSRequestTypeUnsubscribePodLog WSRequestType = "unsubscribePodLog"

	// exec
	WSRequestTypeExecStartSession WSRequestType = "execStartSession"
	WSRequestTypeExecEndSession   WSRequestType = "execEndSession"
	WSRequestTypeExecStdin        WSRequestType = "stdin"
	WSRequestTypeExecResize       WSRequestType = "resize"
)

type WSRequest struct {
	Type WSRequestType `json:"type"`
}

type WSClientAuthRequest struct {
	WSRequest `json:",inline"`
	AuthToken string `json:"authToken"`
}

type WSPodResourceRequest struct {
	WSRequest `json:",inline"`
	PodName   string `json:"podName"`
	Namespace string `json:"namespace"`
	Data      string `json:"data"`
}

type StatusValue int

const StatusOK StatusValue = 0
const StatusError StatusValue = -1

type WSResponseType string

const (
	// a default response type which can be ignore in logic, but useful for debug
	WSResponseTypeCommon WSResponseType = "common"

	// auth flow responses
	WSResponseTypeAuthResult WSResponseType = "authResult"
	WSResponseTypeAuthStatus WSResponseType = "authStatus"

	// log
	WSResponseTypeLogStreamUpdate       WSResponseType = "logStreamUpdate"
	WSResponseTypeLogStreamDisconnected WSResponseType = "logStreamDisconnected"

	// exec
	WSResponseTypeExecStdout       WSResponseType = "execStreamUpdate"
	WSResponseTypeExecDisconnected WSResponseType = "execStreamDisconnected"
)

type WSResponse struct {
	Type    WSResponseType `json:"type"`
	Status  StatusValue    `json:"status"`
	Message string         `json:"message"`
}

type WSPodDataResponse struct {
	Type      WSResponseType `json:"type"`
	Namespace string         `json:"namespace"`
	PodName   string         `json:"podName"`
	Data      string         `json:"data"`
}

const END_OF_TRANSMISSION = "\u0004"

// TerminalSession
type TerminalSession struct {
	wsConn *WSConn
	// data in this channel will be passed to process
	stdinChan chan []byte

	// resize info to process
	sizeChan chan *remotecommand.TerminalSize

	// lifecycle controller
	ctx context.Context

	namespace string

	podName string
}

func NewTerminalSession(conn *WSConn, ctx context.Context, ns, podName string) *TerminalSession {
	return &TerminalSession{
		conn,
		make(chan []byte),
		make(chan *remotecommand.TerminalSize),
		ctx,
		ns,
		podName,
	}
}

func (t *TerminalSession) Next() *remotecommand.TerminalSize {
	select {
	case size := <-t.sizeChan:
		return size
	case <-t.ctx.Done():
		return nil
	}
}

func (t *TerminalSession) Read(p []byte) (int, error) {
	select {
	case data := <-t.stdinChan:
		return copy(p, data), nil
	case <-t.ctx.Done():
		return copy(p, END_OF_TRANSMISSION), nil
	}
}

func (t *TerminalSession) Write(p []byte) (int, error) {
	err := t.wsConn.WriteJSON(&WSPodDataResponse{
		Type:      WSResponseTypeExecStdout,
		Namespace: t.namespace,
		PodName:   t.podName,
		Data:      string(p),
	})

	if err != nil {
		return 0, err
	}

	return len(p), nil
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(*http.Request) bool {
		return true
	},
}

func isNormalWebsocketCloseError(err error) bool {
	return websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived)
}

func wsReadLoop(conn *WSConn, clientManager *client.ClientManager) (err error) {
	for {
		_, message, err := conn.ReadMessage()

		if err != nil {
			if isNormalWebsocketCloseError(err) {
				return nil
			}
			log.Error(err)
			return err
		}

		var basicMessage WSRequest
		err = json.Unmarshal(message, &basicMessage)

		if err != nil {
			log.Error(err)
			continue
		}

		res := WSResponse{
			Type:   WSResponseTypeCommon,
			Status: StatusError,
		}

		switch basicMessage.Type {
		case WSRequestTypeAuth:
			res.Type = WSResponseTypeAuthResult
			var m WSClientAuthRequest
			err = json.Unmarshal(message, &m)

			if err != nil {
				log.Error(err)
				continue
			}

			authInfo := &api.AuthInfo{Token: m.AuthToken}

			if clientManager.IsAuthInfoWorking(authInfo) == nil {
				cfg, err := clientManager.GetClientConfigWithAuthInfo(authInfo)

				if err != nil {
					log.Error(err)
					continue
				}

				k8sClient, err := kubernetes.NewForConfig(cfg)

				if err != nil {
					log.Error(err)
					continue
				}

				conn.K8sClient = k8sClient
				conn.K8sConfig = cfg
				conn.IsAuthorized = true

				res.Status = StatusOK
				res.Message = "Auth Successfully"
			} else {
				res.Message = "Invalid Auth Token"
			}
		case WSRequestTypeSubscribePodLog, WSRequestTypeUnsubscribePodLog, WSRequestTypeExecStartSession, WSRequestTypeExecEndSession, WSRequestTypeExecStdin, WSRequestTypeExecResize:
			isAuthorized := conn.IsAuthorized

			if !isAuthorized {
				res.Message = "Unauthorized, Please verify yourself first."
				break
			}

			var m WSPodResourceRequest
			err = json.Unmarshal(message, &m)

			if err != nil {
				log.Error(err)
				continue
			}

			conn.podResourceRequest <- &m

			//res.Status = StatusOK
			//res.Message = "Request Success"

			// no need to return any value
			continue
		case WSRequestTypeAuthStatus:
			res.Type = WSResponseTypeAuthStatus
			if conn.IsAuthorized {
				res.Status = StatusOK
				res.Message = "You are authorized"
			} else {
				res.Message = "You are not authorized"
			}
		default:
			res.Message = "Unknown Message Type"
		}

		err = conn.WriteJSON(res)

		if err != nil {
			if !isNormalWebsocketCloseError(err) {
				log.Error(err)
			}
			return err
		}
	}
}

func handleLogRequests(conn *WSConn) {
	podRegistrations := make(map[string]context.CancelFunc)

	defer func() {
		for _, cancelFunc := range podRegistrations {
			cancelFunc()
		}
	}()

	for {
		select {
		case <-conn.ctx.Done():
			return
		case m := <-conn.podResourceRequest:
			key := fmt.Sprintf("%s___%s", m.Namespace, m.PodName)

			if m.Type == WSRequestTypeSubscribePodLog {
				k8sClient := conn.K8sClient

				lines := int64(300)

				podLogOpts := coreV1.PodLogOptions{
					Follow:    true,
					TailLines: &lines,
				}

				req := k8sClient.CoreV1().Pods(m.Namespace).GetLogs(m.PodName, &podLogOpts)
				podLogs, err := req.Stream()

				if err != nil {
					log.Error(err)
					_ = conn.WriteJSON(&WSPodDataResponse{
						Type:      WSResponseTypeLogStreamDisconnected,
						Namespace: m.Namespace,
						PodName:   m.PodName,
						Data:      err.Error(),
					})
					continue
				}

				ctx, stop := context.WithCancel(conn.ctx)
				if oldStop, existing := podRegistrations[key]; existing {
					oldStop()
				}
				podRegistrations[key] = stop

				go func() {
					copyPodLogStreamToWS(ctx, m.Namespace, m.PodName, conn, podLogs)
					delete(podRegistrations, key)
				}()
			} else {
				if stop, existing := podRegistrations[key]; existing {
					stop()
					delete(podRegistrations, key)
				}
			}
		}
	}
}

func copyPodLogStreamToWS(ctx context.Context, namespace, podName string, conn *WSConn, logStream io.ReadCloser) {
	defer logStream.Close()

	defer func() {
		// tell client we are no longer provide logs of this pod
		// It doesn't matter if the conn is closed, ignore the error
		_ = conn.WriteJSON(&WSPodDataResponse{
			Type:      WSResponseTypeLogStreamDisconnected,
			Namespace: namespace,
			PodName:   podName,
		})
	}()

	buf := utils.BufferPool.Get()
	defer utils.BufferPool.Put(buf)

	bufChan := make(chan []byte)

	go func() {
		// this go routine will exit when the stream is closed
		for {
			size, err := logStream.Read(buf)

			if err != nil {
				if !strings.Contains(err.Error(), "body closed") {
					log.Error(err)
				}
				close(bufChan)
				return
			}

			bufChan <- buf[:size]
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case data, ok := <-bufChan:
			if !ok {
				return
			}

			err := conn.WriteJSON(&WSPodDataResponse{
				Type:      WSResponseTypeLogStreamUpdate,
				Namespace: namespace,
				PodName:   podName,
				Data:      string(data),
			})

			if err != nil {

				if !isNormalWebsocketCloseError(err) {
					log.Error(err)
				}
				return
			}
		}
	}
}

func startExecTerminalSession(conn *WSConn, shell string, terminalSession *TerminalSession, ns, podName string) error {
	req := conn.K8sClient.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(ns).
		SubResource("exec")

	req = req.VersionedParams(&coreV1.PodExecOptions{
		Command: []string{shell},
		Stdin:   true,
		Stdout:  true,
		Stderr:  true,
		TTY:     true,
	}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(conn.K8sConfig, "POST", req.URL())

	if err != nil {
		return err
	}

	err = exec.Stream(remotecommand.StreamOptions{
		Stdin:             terminalSession,
		Stdout:            terminalSession,
		Stderr:            terminalSession,
		TerminalSizeQueue: terminalSession,
		Tty:               true,
	})

	return err
}

func handleExecRequests(conn *WSConn) {
	podRegistrations := make(map[string]context.CancelFunc)
	terminalSessions := make(map[string]*TerminalSession)
	mut := &sync.Mutex{}

	defer func() {
		for _, cancelFunc := range podRegistrations {
			cancelFunc()
		}
	}()

	for {
		select {
		case <-conn.ctx.Done():
			return
		case m := <-conn.podResourceRequest:
			key := fmt.Sprintf("%s___%s", m.Namespace, m.PodName)

			if m.Type == WSRequestTypeExecStartSession {
				ctx, stop := context.WithCancel(conn.ctx)

				if oldStop, existing := podRegistrations[key]; existing {
					oldStop()
				}

				session := NewTerminalSession(conn, ctx, m.Namespace, m.PodName)

				mut.Lock()
				podRegistrations[key] = stop
				terminalSessions[key] = session
				mut.Unlock()

				go func() {
					defer func() {
						stop()
						mut.Lock()
						delete(podRegistrations, key)
						delete(terminalSessions, key)
						mut.Unlock()
					}()

					var err error
					validShells := []string{"bash", "sh"}
					for _, shell := range validShells {
						err = startExecTerminalSession(conn, shell, session, m.Namespace, m.PodName)

						if err == nil {
							break
						}
					}

					var data string

					if err != nil {
						log.Error("Start Exec Terminal Session Error:", err)
						data = err.Error()
					}

					_ = conn.WriteJSON(&WSPodDataResponse{
						Type:      WSResponseTypeExecDisconnected,
						Namespace: m.Namespace,
						PodName:   m.PodName,
						Data:      data,
					})
				}()
			} else if m.Type == WSRequestTypeExecEndSession {
				if stop, existing := podRegistrations[key]; existing {
					stop()
					mut.Lock()
					delete(podRegistrations, key)
					delete(terminalSessions, key)
					mut.Unlock()
				}
			} else if m.Type == WSRequestTypeExecStdin {
				session, existing := terminalSessions[key]

				if !existing {
					log.Error("can't find terminal session", key)
					continue
				}

				session.stdinChan <- []byte(m.Data)
			} else if m.Type == WSRequestTypeExecResize {
				session, existing := terminalSessions[key]

				if !existing {
					log.Error("can't find terminal session", key)
					continue
				}

				parts := strings.Split(m.Data, ",")

				width, _ := strconv.Atoi(parts[0])
				height, _ := strconv.Atoi(parts[1])

				session.sizeChan <- &remotecommand.TerminalSize{Width: uint16(width), Height: uint16(height)}
			}
		}
	}
}

func (h *ApiHandler) prepareWSConnection(c echo.Context) (*WSConn, error) {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)

	if err != nil {
		log.Error("upgrade:", err)
		return nil, err
	}

	authInfo := client.ExtractAuthInfo(c)
	ctx, stop := context.WithCancel(context.Background())

	conn := &WSConn{
		Conn:               ws,
		ctx:                ctx,
		stopFunc:           stop,
		podResourceRequest: make(chan *WSPodResourceRequest),
		IsAuthorized:       authInfo != nil && h.clientManager.IsAuthInfoWorking(authInfo) == nil,
		writeLock:          &sync.Mutex{},
	}

	if conn.IsAuthorized {
		clientConfig, err := h.clientManager.GetClientConfig(c)

		if err != nil {
			return nil, err
		}

		k8sClient, err := kubernetes.NewForConfig(clientConfig)

		if err != nil {
			return nil, err
		}

		conn.K8sClient = k8sClient
		conn.K8sConfig = clientConfig
	}

	return conn, nil
}

func (h *ApiHandler) logWebsocketHandler(c echo.Context) error {
	conn, err := h.prepareWSConnection(c)

	if err != nil {
		return err
	}

	defer func() {
		conn.stopFunc()
		_ = conn.Close()
	}()

	go handleLogRequests(conn)
	_ = wsReadLoop(conn, h.clientManager)

	return nil
}

func (h *ApiHandler) execWebsocketHandler(c echo.Context) error {
	conn, err := h.prepareWSConnection(c)

	if err != nil {
		return err
	}

	defer func() {
		conn.stopFunc()
		_ = conn.Close()
	}()

	go handleExecRequests(conn)
	_ = wsReadLoop(conn, h.clientManager)

	return nil
}
