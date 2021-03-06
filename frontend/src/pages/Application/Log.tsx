import { Chip, createStyles, Paper, TextField, Theme, withStyles } from "@material-ui/core";
import { WithStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import { Autocomplete, AutocompleteProps, UseAutocompleteProps } from "@material-ui/lab";
import { replace } from "connected-react-router";
import debug from "debug";
import queryString from "query-string";
import React from "react";
import ReconnectingWebSocket from "reconnecting-websocket";
import "xterm/css/xterm.css";
import { k8sWsPrefix } from "../../actions/kubernetesApi";
import { Breadcrumb } from "../../widgets/Breadcrumbs";
import { Loading } from "../../widgets/Loading";
import { ApplicationItemDataWrapper, WithApplicationItemDataProps } from "./ItemDataWrapper";
import { Xterm, XtermRaw } from "./Xterm";

const logger = debug("ws");
const detailedLogger = debug("ws:details");

// generated by https://www.kammerl.de/ascii/AsciiSignature.php
const logDocs =
  " _                   _______          _   _____           _                   _   _                 \n" +
  "| |                 |__   __|        | | |_   _|         | |                 | | (_)                \n" +
  "| |     ___   __ _     | | ___   ___ | |   | |  _ __  ___| |_ _ __ _   _  ___| |_ _  ___  _ __  ___ \n" +
  "| |    / _ \\ / _` |    | |/ _ \\ / _ \\| |   | | | '_ \\/ __| __| '__| | | |/ __| __| |/ _ \\| '_ \\/ __|\n" +
  "| |___| (_) | (_| |    | | (_) | (_) | |  _| |_| | | \\__ \\ |_| |  | |_| | (__| |_| | (_) | | | \\__ \\\n" +
  "|______\\___/ \\__, |    |_|\\___/ \\___/|_| |_____|_| |_|___/\\__|_|   \\__,_|\\___|\\__|_|\\___/|_| |_|___/\n" +
  "              __/ |                                                                                 \n" +
  "             |___/                                                                                  \n\n\n\n" +
  `\u001b[1;32m1\u001b[0m. Select the pod you are following in the selection menu above.

\u001b[1;32m2\u001b[0m. The select supports multiple selections, you can switch the log stream by clicking on the pod's tab.

\u001b[1;32m3\u001b[0m. The url is changing with your choices, you can share this url with other colleagues who has permissions.

\u001b[1;32m4\u001b[0m. Only the latest logs of each pod are displayed. If you want query older logs with advanced tool, please try learn about kapp log dependency.`;

const shellDocs =
  " _____  _          _ _   _______          _   _____           _                   _   _                 \n" +
  "/ ____ | |        | | | |__   __|        | | |_   _|         | |                 | | (_)                \n" +
  "| (___ | |__   ___| | |    | | ___   ___ | |   | |  _ __  ___| |_ _ __ _   _  ___| |_ _  ___  _ __  ___ \n" +
  "\\___  \\| '_ \\ / _ \\ | |    | |/ _ \\ / _ \\| |   | | | '_ \\/ __| __| '__| | | |/ __| __| |/ _ \\| '_ \\/ __|\n" +
  "____)  | | | |  __/ | |    | | (_) | (_) | |  _| |_| | | \\__ \\ |_| |  | |_| | (__| |_| | (_) | | | \\__ \\\n" +
  "|_____/|_| |_|\\___|_|_|    |_|\\___/ \\___/|_| |_____|_| |_|___/\\__|_|   \\__,_|\\___|\\__|_|\\___/|_| |_|___/\n" +
  "\n\n\n\n" +
  `\u001b[1;32m1\u001b[0m. Select the pod you are following in the selection menu above.

\u001b[1;32m2\u001b[0m. The select supports multiple selections, you can switch the shell sessions by clicking on the pod's tab.

\u001b[1;32m3\u001b[0m. The url is changing with your choices, you can share this url with other colleagues who has permissions.`;

interface TabPanelProps {
  children?: React.ReactNode;
  index: any;
  value: any;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <Typography
      component="div"
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}>
      {children}
    </Typography>
  );
}

const autocompleteStyles = (_theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
      "& .MuiFormControl-root": {
        width: "100%",
        margin: "12px 0"
      }
    }
  });

const MyAutocomplete = withStyles(autocompleteStyles)(
  (props: AutocompleteProps<string> & UseAutocompleteProps<string>) => {
    return <Autocomplete {...props} />;
  }
);

interface Props extends WithApplicationItemDataProps, WithStyles<typeof styles> {}

interface State {
  value: any;
  subscribedPodNames: Set<string>;
}

const styles = (theme: Theme) =>
  createStyles({
    root: {},
    paper: {
      padding: theme.spacing(2)
    }
  });

export const generateQueryForPods = (namespace: string, podNames: string[], active?: string) => {
  const search = {
    pods: podNames.length > 0 ? podNames : undefined,
    active: active || undefined,
    namespace
  };

  return queryString.stringify(search, { arrayFormat: "comma" });
};

export class LogStream extends React.PureComponent<Props, State> {
  private ws: ReconnectingWebSocket;
  private wsQueueMessages: any[] = [];
  private terminals: Map<string, XtermRaw> = new Map();
  private initalizedFromQuery: boolean = false;
  private isLog: boolean; // TODO: refactor this flag
  constructor(props: Props) {
    super(props);

    this.state = {
      value: "",
      subscribedPodNames: new Set()
    };

    this.isLog = window.location.pathname.includes("logs");

    this.ws = this.connectWs();
  }

  private saveTerminal = (name: string, el: XtermRaw | null) => {
    if (el) {
      this.terminals.set(name, el);
    } else {
      this.terminals.delete(name);
    }
  };

  componentWillUnmount() {
    if (this.ws) {
      this.ws.close();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { application } = this.props;
    const podNames = application!.get("podNames");
    if (
      prevState.subscribedPodNames.size !== this.state.subscribedPodNames.size ||
      this.state.value !== prevState.value
    ) {
      // save selected pods in query
      const search = {
        ...queryString.parse(window.location.search, { arrayFormat: "comma" }),
        pods: this.state.subscribedPodNames.size > 0 ? Array.from(this.state.subscribedPodNames) : undefined,
        active: !!this.state.value ? this.state.value : undefined
      };

      this.props.dispatch(
        replace({
          search: queryString.stringify(search, { arrayFormat: "comma" })
        })
      );
    }

    if (podNames && !this.initalizedFromQuery) {
      // load selected pods from query, this is useful when first loaded.
      const queries = queryString.parse(window.location.search, { arrayFormat: "comma" }) as {
        pods: string[] | string | undefined;
        active: string | undefined;
      };
      let validPods: string[] = [];
      let validValue: string = "";

      if (queries.pods) {
        if (typeof queries.pods === "object") {
          validPods = queries.pods.filter(x => podNames.includes(x));
        } else {
          validPods = [queries.pods];
        }
      }

      if (queries.active) {
        validValue = podNames.includes(queries.active) ? queries.active : "";
      }

      if (this.state.value !== validValue) {
        this.setState({
          value: validValue
        });
      }

      if (this.state.subscribedPodNames.size !== validPods.length) {
        this.setState({
          subscribedPodNames: new Set(validPods)
        });
      }

      this.initalizedFromQuery = true;
    }
  }

  connectWs = () => {
    const ws = new ReconnectingWebSocket(`${k8sWsPrefix}/v1alpha1/${this.isLog ? "logs" : "exec"}`);

    ws.onopen = evt => {
      logger("WS Connection connected.");
      ws.send(
        JSON.stringify({
          type: "authStatus"
        })
      );
    };

    const afterWsAuthSuccess = () => {
      const { subscribedPodNames } = this.state;

      if (subscribedPodNames.size > 0) {
        Array.from(subscribedPodNames).forEach(this.subscribe);
      }

      while (this.wsQueueMessages.length > 0) {
        ws.send(this.wsQueueMessages.shift());
      }
    };

    ws.onmessage = evt => {
      detailedLogger("Received Message: " + evt.data);
      const data = JSON.parse(evt.data);

      if (data.type === "logStreamUpdate" || data.type === "execStreamUpdate") {
        const terminal = this.terminals.get(data.podName);
        if (terminal && terminal.xterm) {
          terminal.xterm.write(data.data);
        }

        return;
      }

      if (data.type === "logStreamDisconnected") {
        const terminal = this.terminals.get(data.podName);
        if (terminal && terminal.xterm) {
          terminal.xterm.write(data.data);
          terminal.xterm.writeln("\n\u001b[1;31mPod log stream disconnected\u001b[0m\n");
        }
        return;
      }

      if (data.type === "execStreamDisconnected") {
        const terminal = this.terminals.get(data.podName);
        if (terminal && terminal.xterm) {
          terminal.xterm.write(data.data);
          terminal.xterm.writeln("\n\r\u001b[1;31mTerminal disconnected\u001b[0m\n");
        }
        return;
      }

      if ((data.type === "authResult" && data.status === 0) || (data.type === "authStatus" && data.status === 0)) {
        afterWsAuthSuccess();
        return;
      }

      if (data.type === "authStatus" && data.status === -1) {
        ws.send(
          JSON.stringify({
            type: "auth",
            authToken: window.localStorage.AUTHORIZED_TOKEN_KEY
          })
        );
        return;
      }
    };

    ws.onclose = evt => {
      logger("WS Connection closed.");
    };

    return ws;
  };

  subscribe = (podName: string) => {
    logger("subscribe", podName);
    const { activeNamespaceName } = this.props;

    this.sendOrQueueMessage(
      JSON.stringify({
        type: this.isLog ? "subscribePodLog" : "execStartSession",
        podName: podName,
        namespace: activeNamespaceName
      })
    );
  };

  unsubscribe = (podName: string) => {
    const { activeNamespaceName } = this.props;
    logger("unsubscribe", podName);
    this.sendOrQueueMessage(
      JSON.stringify({
        type: this.isLog ? "unsubscribePodLog" : "execEndSession",
        podName: podName,
        namespace: activeNamespaceName
      })
    );
  };

  sendOrQueueMessage = (msg: any) => {
    if (this.ws.readyState !== 1) {
      this.wsQueueMessages.push(msg);
    } else {
      this.ws.send(msg);
    }
  };

  onInputChange = (_event: React.ChangeEvent<{}>, x: string[]) => {
    const currentSet = new Set(x);
    const needSub = Array.from(currentSet).filter(x => !this.state.subscribedPodNames.has(x));
    const needUnsub = Array.from(this.state.subscribedPodNames).filter(x => !currentSet.has(x));
    const intersection = Array.from(currentSet).filter(x => this.state.subscribedPodNames.has(x));

    needSub.forEach(this.subscribe);
    needUnsub.forEach(this.unsubscribe);

    const { value } = this.state;
    let newValue = value;
    if (needUnsub.includes(value)) {
      if (needSub.length > 0) {
        newValue = needSub[0];
      } else if (intersection.length > 0) {
        newValue = intersection[0];
      } else {
        newValue = "";
      }
    } else if (value === "" && needSub.length > 0) {
      newValue = needSub[0];
    } else if (needSub.length === 1 && needUnsub.length === 0) {
      newValue = needSub[0];
    }

    this.setState({ subscribedPodNames: currentSet, value: newValue });
  };

  private renderInput() {
    const { application } = this.props;
    const podNames = application!.get("podNames");
    const { value, subscribedPodNames } = this.state;
    const names = podNames!.toArray().filter(x => !subscribedPodNames.has(x));

    return (
      <MyAutocomplete
        multiple
        id="tags-filled"
        options={names}
        onChange={this.onInputChange}
        value={Array.from(subscribedPodNames)}
        renderTags={(options: string[], getTagProps) =>
          options.map((option: string, index: number) => {
            return (
              <Chip
                variant="outlined"
                label={option}
                size="small"
                onClick={event => {
                  this.setState({ value: option });
                  event.stopPropagation();
                }}
                color={option === value ? "primary" : "default"}
                {...getTagProps({ index })}
              />
            );
          })
        }
        renderInput={params => (
          <TextField {...params} variant="outlined" size="small" placeholder="Select the pod you want to view logs" />
        )}
      />
    );
  }

  private renderLogTerminal = (podName: string, initializedContent?: string) => {
    const { value } = this.state;
    return (
      <Xterm
        innerRef={el => this.saveTerminal(podName, el)}
        show={value === podName}
        initializedContent={initializedContent}
        terminalOptions={{
          cursorBlink: false,
          cursorStyle: "bar",
          cursorWidth: 0,
          disableStdin: true,
          convertEol: true,
          // fontSize: 12,
          theme: { selection: "rgba(255, 255, 72, 0.5)" }
        }}
      />
    );
  };

  private renderExecTerminal = (podName: string, initializedContent?: string) => {
    const { value } = this.state;
    return (
      <Xterm
        innerRef={el => this.saveTerminal(podName, el)}
        show={value === podName}
        initializedContent={initializedContent}
        termianlOnData={(data: any) => {
          this.sendOrQueueMessage(
            JSON.stringify({
              type: "stdin",
              podName: podName,
              namespace: this.props.activeNamespaceName,
              data: data
            })
          );
        }}
        termianlOnBinary={(data: any) => {
          this.sendOrQueueMessage(
            JSON.stringify({
              type: "stdin",
              podName: podName,
              namespace: this.props.activeNamespaceName,
              data: data
            })
          );
        }}
        terminalOnResize={(size: { cols: number; rows: number }) => {
          this.sendOrQueueMessage(
            JSON.stringify({
              type: "resize",
              podName: podName,
              namespace: this.props.activeNamespaceName,
              data: `${size.cols},${size.rows}`
            })
          );
        }}
        terminalOptions={{
          // convertEol: true,
          // fontSize: 12,
          theme: { selection: "rgba(255, 255, 72, 0.5)" }
        }}
      />
    );
  };

  public render() {
    const { isLoading, application, classes } = this.props;
    const { value, subscribedPodNames } = this.state;

    return (
      <Paper elevation={2} classes={{ root: classes.paper }}>
        <Breadcrumb />
        {isLoading || !application ? (
          <Loading />
        ) : (
          <>
            {this.renderInput()}
            <div>
              <TabPanel value={value} key={"empty"} index={""}>
                {this.isLog ? this.renderLogTerminal("", logDocs) : this.renderLogTerminal("", shellDocs)}
              </TabPanel>
              {Array.from(subscribedPodNames).map(x => {
                return (
                  <TabPanel value={value} key={x} index={x}>
                    {this.isLog ? this.renderLogTerminal(x) : this.renderExecTerminal(x)}
                  </TabPanel>
                );
              })}
            </div>
          </>
        )}
      </Paper>
    );
  }
}

export const Log = withStyles(styles)(ApplicationItemDataWrapper({ reloadFrequency: 0 })(LogStream));
