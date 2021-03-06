import { Box, createStyles, Grid, Paper, Theme, withStyles, WithStyles } from "@material-ui/core";
import DeleteIcon from "@material-ui/icons/Delete";
import LaptopWindowsIcon from "@material-ui/icons/LaptopWindows";
import ViewHeadlineIcon from "@material-ui/icons/ViewHeadline";
import clsx from "clsx";
import React from "react";
import { ThunkDispatch } from "redux-thunk";
import { loadApplicationAction } from "../../actions/application";
import { deletePod } from "../../actions/kubernetesApi";
import { setErrorNotificationAction, setSuccessNotificationAction } from "../../actions/notification";
import { RootState } from "../../reducers";
import { Actions } from "../../types";
import { ApplicationDetails, PodStatus } from "../../types/application";
import { formatTimeDistance } from "../../utils";
import { ErrorBedge, PendingBedge, SuccessBedge } from "../../widgets/Bedge";
import { IconButtonWithTooltip, IconLinkWithToolTip } from "../../widgets/IconButtonWithTooltip";
import {
  BigCPULineChart,
  BigMemoryLineChart,
  SmallCPULineChart,
  SmallMemoryLineChart
} from "../../widgets/SmallLineChart";
import { generateQueryForPods } from "./Log";
import { withNamespace, withNamespaceProps } from "permission/Namespace";
import { EXTERNAL_ACCESS_PLUGIN_TYPE, ExternalAccessPlugin } from "types/plugin";
import Immutable from "immutable";
import { ImmutableMap } from "typings";
const styles = (theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(2)
    },
    componentRow: {
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(1.5),
      "& .name": {
        fontSize: 14
      }
    },
    componentContainer: {
      marginTop: theme.spacing(2),
      background: "#f5f5f5"
    },
    podContainer: {
      background: "#eaeaea"
    },
    chartTabelCell: {
      width: 130,
      textAlign: "center"
    },
    timeCell: {
      width: 100,
      textAlign: "center"
    },
    statusCell: {
      width: 200,
      textAlign: "center"
    },
    restartsCountCell: {
      width: 90,
      textAlign: "center"
    },
    rowContainer: {
      display: "flex",
      alignItems: "center",
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
      justifyContent: "space-between",
      "& .right-part": {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }
    },
    podHeaderRow: {
      color: "rgba(0, 0, 0, 0.87)",
      fontWeight: 500,
      lineHeight: "1.2857142857142856rem",
      "& .headerCell": {
        padding: "6px 16px 6px 16px",
        "&:last-child": {
          paddingRight: 0
        }
      },
      "& > .headerCell:first-child": {
        paddingLeft: 0
      }
    },
    podDataRow: {
      "& > :nth-child(1)": {
        flex: 1
      },
      "& > :nth-child(2)": {
        flex: 1
      }
    },
    actionCell: {
      width: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around"
    },
    podActionButton: {
      background: "white"
    },
    metrics: {}
  });

interface Props extends WithStyles<typeof styles>, withNamespaceProps {
  application: ApplicationDetails;
  activeNamespaceName: string;
  dispatch: ThunkDispatch<RootState, undefined, Actions>;
}

interface State {}

class DetailsRaw extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  private renderPodStatus = (pod: PodStatus) => {
    if (pod.get("isTerminating")) {
      return <PendingBedge />;
    }

    switch (pod.get("status")) {
      case "Running": {
        return <SuccessBedge />;
      }
      case "Pending": {
        return <PendingBedge />;
      }
      case "Succeeded": {
        return <SuccessBedge />;
      }
      case "Failed": {
        return <ErrorBedge />;
      }
    }
  };

  private renderComponent = (index: number) => {
    const { classes, application, dispatch, hasRole } = this.props;
    const componentStatus = application.get("componentsStatus")!.get(index)!;
    const component = application.get("components").get(index)!;
    const hasWriterRole = hasRole("writer");
    const externalAccessPlugin =
      component.get("plugins") &&
      (component.get("plugins")!.filter(p => p.get("type") === EXTERNAL_ACCESS_PLUGIN_TYPE) as
        | Immutable.List<ImmutableMap<ExternalAccessPlugin>>
        | undefined);
    return (
      <Paper className={classes.componentContainer} key={index}>
        <div className={clsx(classes.rowContainer, classes.componentRow)}>
          <div className="name">
            <strong>{componentStatus.get("name")}</strong> ({componentStatus.get("workloadType")})
          </div>
          {/* <div className="right-part">
            <div className={classes.chartTabelCell}>
              <SmallCPULineChart data={component.get("metrics").get("cpu")!} />
            </div>
            <div className={classes.chartTabelCell}>
              <SmallMemoryLineChart data={component.get("metrics").get("memory")!} />
            </div>
          </div> */}
        </div>
        <Box p={2}>
          <div>Internal Endpoints:</div>
          <Box ml={2}>
            {componentStatus
              .get("services")
              .map(serviceStatus => {
                const dns = `${serviceStatus.get("name")}.${application.get("namespace")}`;
                return serviceStatus
                  .get("ports")
                  .map(port => {
                    return (
                      <div key={port.get("name")}>
                        <strong>{port.get("name")}</strong>: {dns}:{port.get("port")}
                      </div>
                    );
                  })
                  .toArray();
              })
              .toArray()
              .flat()}
          </Box>
        </Box>
        {externalAccessPlugin ? (
          <Box p={2}>
            <div>External Endpoints:</div>
            <Box ml={2}>
              {externalAccessPlugin
                .map(plugin => {
                  const hosts: string[] = plugin.get("hosts") ? plugin.get("hosts")!.toArray() : [];
                  const paths: string[] = plugin.get("paths") ? plugin.get("paths")!.toArray() : ["/"];
                  const schema = plugin.get("enableHttps") ? "https" : "http";
                  return hosts.map(host => {
                    return paths.map(path => {
                      const url = `${schema}://${host}${path}`;
                      return (
                        <a href={url} key={url} target="_blank" rel="noopener noreferrer">
                          {url}
                        </a>
                      );
                    });
                  });
                })
                .toArray()
                .flat()}
            </Box>
          </Box>
        ) : null}
        <div className={classes.podContainer}>
          {componentStatus.get("pods").size > 0 ? (
            <div className={clsx(classes.rowContainer, classes.podHeaderRow, classes.podDataRow)}>
              <div className="headerCell">Pod Name</div>
              <div className="headerCell">Node</div>
              <div className="right-part">
                <div className={clsx("headerCell", classes.restartsCountCell)}>Restarts</div>
                <div className={clsx("headerCell", classes.statusCell)}>Status</div>
                <div className={clsx("headerCell", classes.timeCell)}>AGE</div>
                {/* <div className={clsx("headerCell", classes.timeCell)}>StartedAt</div> */}
                <div className={clsx("headerCell", classes.chartTabelCell)}>CPU</div>
                <div className={clsx("headerCell", classes.chartTabelCell)}>Memory</div>
                <div className={clsx("headerCell", classes.actionCell)}>Actions</div>
              </div>
            </div>
          ) : null}
          {componentStatus
            .get("pods")
            .map(x => {
              return (
                <div key={x.get("name")}>
                  <div key={x.get("name")} className={clsx(classes.rowContainer, classes.podDataRow)}>
                    {/* <div className={classes.podContainer} key={x.get("name")}> */}

                    <div style={{ display: "flex", alignItems: "center" }}>
                      {this.renderPodStatus(x)}
                      {x.get("name")}
                    </div>
                    <div>{x.get("node")}</div>
                    <div className="right-part">
                      <div className={classes.restartsCountCell}>{x.get("restarts")}</div>
                      <div className={classes.statusCell}>{x.get("statusText")}</div>
                      <div className={classes.timeCell}>{formatTimeDistance(x.get("createTimestamp"))}</div>
                      {/* <div className={classes.timeCell}>{differenceInMinutes(x.get("startTimestamp"), new Date())}</div> */}
                      <div className={classes.chartTabelCell}>
                        <SmallCPULineChart data={x.get("metrics").get("cpu")!} />
                      </div>
                      <div className={classes.chartTabelCell}>
                        <SmallMemoryLineChart data={x.get("metrics").get("memory")!} />
                      </div>
                      <div className={classes.actionCell}>
                        <IconLinkWithToolTip
                          className={classes.podActionButton}
                          size="small"
                          tooltipTitle="Log"
                          to={
                            `/applications/${application.get("name")}/logs?` +
                            generateQueryForPods(this.props.activeNamespaceName, [x.get("name")], x.get("name"))
                          }>
                          <ViewHeadlineIcon />
                        </IconLinkWithToolTip>
                        {hasWriterRole ? (
                          <IconLinkWithToolTip
                            tooltipTitle="Shell"
                            size="small"
                            className={classes.podActionButton}
                            to={
                              `/applications/${application.get("name")}/shells?` +
                              generateQueryForPods(this.props.activeNamespaceName, [x.get("name")], x.get("name"))
                            }>
                            <LaptopWindowsIcon />
                          </IconLinkWithToolTip>
                        ) : null}
                        {hasWriterRole ? (
                          <IconButtonWithTooltip
                            tooltipTitle="Delete"
                            size="small"
                            className={classes.podActionButton}
                            onClick={async () => {
                              try {
                                await deletePod(application.get("namespace"), x.get("name"));
                                dispatch(setSuccessNotificationAction(`Delete pod ${x.get("name")} successfully`));
                                // reload
                                dispatch(loadApplicationAction(application.get("namespace"), application.get("name")));
                              } catch (e) {
                                dispatch(setErrorNotificationAction(e.response.data.message));
                              }
                            }}>
                            <DeleteIcon />
                          </IconButtonWithTooltip>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <Box pl={2} pr={2}>
                    {/* Do not show errors when pod is terminating */}
                    {x.get("isTerminating")
                      ? null
                      : x
                          .get("warnings")
                          .map((w, index) => {
                            return (
                              <Box ml={2} color="error.main" key={index}>
                                {index + 1}. {w.get("message")}
                              </Box>
                            );
                          })
                          .toArray()}
                  </Box>
                </div>
              );
            })
            .toArray()}
        </div>
      </Paper>
    );
  };

  public render() {
    const { application, classes } = this.props;
    return (
      <div className={classes.root}>
        <Grid container spacing={2} className={classes.metrics}>
          <Grid item md={6}>
            <BigCPULineChart data={application.get("metrics").get("cpu")} />
          </Grid>
          <Grid item md={6}>
            <BigMemoryLineChart data={application.get("metrics").get("memory")} />
          </Grid>
        </Grid>
        {application
          .get("components")!
          .map((_x, index) => this.renderComponent(index))
          .toArray()}
      </div>
    );
  }
}

export const Details = withStyles(styles)(withNamespace(DetailsRaw));
