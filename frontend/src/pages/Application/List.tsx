import {
  Button,
  Checkbox,
  createStyles,
  Switch,
  TextField,
  Theme,
  WithStyles,
  withStyles,
  Tooltip
} from "@material-ui/core";
import { grey } from "@material-ui/core/colors";
import ArchiveIcon from "@material-ui/icons/Archive";
import PowerSettingsNewIcon from "@material-ui/icons/PowerSettingsNew";
import RefreshIcon from "@material-ui/icons/Refresh";
import MaterialTable, { Components } from "material-table";
import React from "react";
import { Link } from "react-router-dom";
import { TableTitle } from "widgets/TableTitle";
import {
  deleteApplicationAction,
  duplicateApplicationAction,
  loadApplicationAction,
  loadApplicationsAction,
  updateApplicationAction
} from "../../actions/application";
import { setErrorNotificationAction, setSuccessNotificationAction } from "../../actions/notification";
import { duplicateApplicationName, getApplicationByName } from "../../selectors/application";
import { ApplicationDetails } from "../../types/application";
import { ConfirmDialog } from "../../widgets/ConfirmDialog";
import { FoldButtonGroup } from "../../widgets/FoldButtonGroup";
import { Loading } from "../../widgets/Loading";
import { SmallCPULineChart, SmallMemoryLineChart } from "../../widgets/SmallLineChart";
import { BasePage } from "../BasePage";
import { ApplicationListDataWrapper, WithApplicationsListDataProps } from "./ListDataWrapper";
import { withNamespace, withNamespaceProps } from "permission/Namespace";
import { AddLink } from "widgets/AddButton";
import { PendingBedge, SuccessBedge, WarningBedge, ErrorBedge } from "widgets/Bedge";
import { FlexRowItemCenterBox } from "widgets/Box";
import HelpIcon from "@material-ui/icons/Help";
import { ControlledDialog } from "widgets/ControlledDialog";
import { CustomizedButton } from "widgets/Button";
import { closeDialogAction, openDialogAction } from "actions/dialog";
import { connect } from "react-redux";
import { RootState } from "reducers";
import { EXTERNAL_ACCESS_PLUGIN_TYPE, ExternalAccessPlugin } from "types/plugin";
import { ImmutableMap } from "typings";

const externalEndpointsModalID = "externalEndpointsModalID";
const internalEndpointsModalID = "internalEndpointsModalID";

const styles = (theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(3),
      "& tr.MuiTableRow-root td": {
        verticalAlign: "middle"
      }
    },
    expansionPanel: {
      boxShadow: "none"
    },
    panelSummary: {
      height: "48px !important",
      minHeight: "48px !important"
    },
    componentWrapper: {
      minWidth: "120px"
    },
    componentLine: {
      display: "inline-block"
    },
    bottomBar: {
      position: "fixed",
      height: "48px",
      bottom: "0",
      left: "0",
      right: "0",
      background: "#FFFFFF",
      boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.25)"
    },
    bottomContent: {
      maxWidth: "1200px",
      margin: "0 auto",
      display: "flex",
      justifyContent: "space-around",
      height: "48px",
      alignItems: "center"
    },
    applicationSelected: {
      display: "flex"
    },
    selectedNumber: {
      width: "20px",
      height: "20px",
      background: "#1976D2",
      color: "#ffffff",
      textAlign: "center",
      marginRight: "8px"
    },
    bottomActions: {
      width: "500px",
      display: "flex",
      justifyContent: "space-around"
    },
    bottomAction: {
      cursor: "pointer",
      display: "flex"
    },
    actionText: {
      marginLeft: "8px"
    },
    duplicateConfirmFileds: {
      marginTop: "20px",
      width: "100%",
      display: "flex",
      justifyContent: "space-between"
    }
  });

const mapStateToProps = (state: RootState) => {
  const internalEndpointsDialog = state.get("dialogs").get(internalEndpointsModalID);
  const externalEndpointsDialog = state.get("dialogs").get(externalEndpointsModalID);

  return {
    internalEndpointsDialogData: internalEndpointsDialog ? internalEndpointsDialog.get("data") : {},
    externalEndpointsDialogData: externalEndpointsDialog ? externalEndpointsDialog.get("data") : {}
  };
};
interface Props
  extends WithApplicationsListDataProps,
    WithStyles<typeof styles>,
    withNamespaceProps,
    ReturnType<typeof mapStateToProps> {}

interface State {
  isActiveConfirmDialogOpen: boolean;
  switchingIsActiveApplicationListItem?: ApplicationDetails;
  isDeleteConfirmDialogOpen: boolean;
  deletingApplicationListItem?: ApplicationDetails;
  isDuplicateConfirmDialogOpen: boolean;
  duplicatingApplicationListItem?: ApplicationDetails;
  checkedApplicationNames: {
    [key: string]: boolean;
  };
}

interface RowData extends ApplicationDetails {
  index: number;
}

class ApplicationListRaw extends React.PureComponent<Props, State> {
  private duplicateApplicationNameRef: React.RefObject<any>;
  private duplicateApplicationNamespaceRef: React.RefObject<any>;
  private tableRef: React.RefObject<MaterialTable<ApplicationDetails>> = React.createRef();

  private defaultState = {
    isActiveConfirmDialogOpen: false,
    switchingIsActiveApplicationListItem: undefined,
    isDeleteConfirmDialogOpen: false,
    deletingApplicationListItem: undefined,
    isDuplicateConfirmDialogOpen: false,
    duplicatingApplicationListItem: undefined,
    checkedApplicationNames: {}
  };

  constructor(props: Props) {
    super(props);
    this.state = this.defaultState;

    this.duplicateApplicationNameRef = React.createRef();
    this.duplicateApplicationNamespaceRef = React.createRef();
  }

  private showSwitchingIsActiveConfirmDialog = (applicationListItem: ApplicationDetails) => {
    this.setState({
      isActiveConfirmDialogOpen: true,
      switchingIsActiveApplicationListItem: applicationListItem
    });
  };

  private closeSwitchingIsActiveConfirmDialog = () => {
    this.setState(this.defaultState);
  };

  private renderSwitchingIsActiveConfirmDialog = () => {
    const { isActiveConfirmDialogOpen, switchingIsActiveApplicationListItem } = this.state;

    let title, content;

    if (switchingIsActiveApplicationListItem && switchingIsActiveApplicationListItem.get("isActive")) {
      title = "Are you sure to disabled this application?";
      content =
        "Disabling this application will delete all running resources in your cluster. TODO: (will disk be deleted? will xxx deleted?)";
    } else {
      title = "Are you sure to active this application?";
      content = "Enabling this application will create xxxx resources. They will spend xxx CPU, xxx Memory. ";
    }

    return (
      <ConfirmDialog
        open={isActiveConfirmDialogOpen}
        onClose={this.closeSwitchingIsActiveConfirmDialog}
        title={title}
        content={content}
        onAgree={this.confirmSwitchIsActive}
      />
    );
  };

  private confirmSwitchIsActive = async () => {
    const { dispatch } = this.props;
    const { switchingIsActiveApplicationListItem } = this.state;

    if (switchingIsActiveApplicationListItem) {
      await dispatch(
        loadApplicationAction(
          switchingIsActiveApplicationListItem?.get("namespace"),
          switchingIsActiveApplicationListItem?.get("name")
        )
      );
      const application = getApplicationByName(switchingIsActiveApplicationListItem?.get("name"));
      await dispatch(updateApplicationAction(application.set("isActive", !application.get("isActive"))));
      dispatch(loadApplicationsAction());
    }
  };

  private showDuplicateConfirmDialog = (duplicatingApplicationListItem: ApplicationDetails) => {
    this.setState({
      isDuplicateConfirmDialogOpen: true,
      duplicatingApplicationListItem
    });
  };

  private closeDuplicateConfirmDialog = () => {
    this.setState(this.defaultState);
  };

  private renderDuplicateConfirmDialog = () => {
    const { classes } = this.props;
    const { isDuplicateConfirmDialogOpen, duplicatingApplicationListItem } = this.state;

    let title, content;
    title = "Duplicate Application";
    content = (
      <div>
        Please confirm the namespace and name of new application.
        <div className={classes.duplicateConfirmFileds}>
          <TextField
            inputRef={this.duplicateApplicationNamespaceRef}
            label="Namespace"
            size="small"
            variant="outlined"
            defaultValue={duplicatingApplicationListItem?.get("namespace")}
            required
          />
          <TextField
            inputRef={this.duplicateApplicationNameRef}
            label="Name"
            size="small"
            variant="outlined"
            defaultValue={duplicateApplicationName(duplicatingApplicationListItem?.get("name") as string)}
            required
          />
        </div>
      </div>
    );

    return (
      <ConfirmDialog
        open={isDuplicateConfirmDialogOpen}
        onClose={this.closeDuplicateConfirmDialog}
        title={title}
        content={content}
        onAgree={this.confirmDuplicate}
      />
    );
  };

  private confirmDuplicate = async () => {
    const { dispatch } = this.props;
    try {
      const { duplicatingApplicationListItem } = this.state;
      if (duplicatingApplicationListItem) {
        await dispatch(
          loadApplicationAction(
            duplicatingApplicationListItem.get("namespace"),
            duplicatingApplicationListItem.get("name")
          )
        );

        let newApplication = getApplicationByName(duplicatingApplicationListItem.get("name"));

        newApplication = newApplication.set("namespace", this.duplicateApplicationNamespaceRef.current.value);
        newApplication = newApplication.set("name", this.duplicateApplicationNameRef.current.value);
        newApplication = newApplication.set("isActive", false);

        dispatch(duplicateApplicationAction(newApplication));
      }
    } catch {
      dispatch(setErrorNotificationAction());
    }
  };

  private showDeleteConfirmDialog = (deletingApplicationListItem: ApplicationDetails) => {
    this.setState({
      isDeleteConfirmDialogOpen: true,
      deletingApplicationListItem
    });
  };

  private closeDeleteConfirmDialog = () => {
    this.setState(this.defaultState);
  };

  private renderDeleteConfirmDialog = () => {
    const { isDeleteConfirmDialogOpen } = this.state;

    return (
      <ConfirmDialog
        open={isDeleteConfirmDialogOpen}
        onClose={this.closeDeleteConfirmDialog}
        title="Are you sure to delete this Application?"
        content="This application is already disabled. You will lost this application config, and this action is irrevocable."
        onAgree={this.confirmDelete}
      />
    );
  };

  private confirmDelete = async () => {
    const { dispatch } = this.props;
    try {
      const { deletingApplicationListItem } = this.state;
      if (deletingApplicationListItem) {
        await dispatch(
          deleteApplicationAction(deletingApplicationListItem.get("namespace"), deletingApplicationListItem.get("name"))
        );
        await dispatch(setSuccessNotificationAction("Successfully delete an application"));
      }
    } catch {
      dispatch(setErrorNotificationAction());
    }
  };

  private renderCheckbox = (applicationListItem: RowData) => {
    return (
      <Checkbox
        onChange={() => {
          // deep copy, new obj
          const applicationNames = { ...this.state.checkedApplicationNames };
          applicationNames[applicationListItem.get("name")] = !applicationNames[applicationListItem.get("name")];
          this.setState({ checkedApplicationNames: applicationNames });
        }}
        value="secondary"
        color="primary"
        inputProps={{ "aria-label": "secondary checkbox" }}
      />
    );
  };

  private renderCPU = (applicationListItem: RowData) => {
    const cpuData = applicationListItem.get("metrics").get("cpu");
    return <SmallCPULineChart data={cpuData} />;
  };
  private renderMemory = (applicationListItem: RowData) => {
    const memoryData = applicationListItem.get("metrics").get("memory");
    return <SmallMemoryLineChart data={memoryData} />;
  };

  private renderName = (rowData: RowData) => {
    return (
      <Link to={`/applications/${rowData.get("name")}?namespace=${this.props.activeNamespaceName}`}>
        {rowData.get("name")}
      </Link>
    );
  };

  private renderNamespace = (applicationListItem: RowData) => {
    return applicationListItem.get("namespace"); // ["default", "production", "ropsten"][index] || "default",
  };

  private renderEnable = (applicationListItem: RowData) => {
    return (
      <Switch
        checked={applicationListItem.get("isActive")}
        onChange={() => {
          this.showSwitchingIsActiveConfirmDialog(applicationListItem);
        }}
        value="checkedB"
        color="primary"
        inputProps={{ "aria-label": "active app.ication" }}
      />
    );
  };

  private renderStatus = (applicationDetails: RowData) => {
    let podCount = 0;
    let successCount = 0;
    let pendingCount = 0;
    let errorCount = 0;
    applicationDetails.get("componentsStatus").forEach(componentStatus => {
      componentStatus.get("pods").forEach(podStatus => {
        podCount++;
        switch (podStatus.get("status")) {
          case "Running": {
            successCount++;
            break;
          }
          case "Pending": {
            pendingCount++;
            break;
          }
          case "Succeeded": {
            successCount++;
            break;
          }
          case "Failed": {
            errorCount++;
            break;
          }
        }
      });
    });

    const tooltipTitle = `Total ${podCount} pods are found. \n${successCount} ready, ${pendingCount} pending, ${errorCount} failed. Click to view details.`;

    return (
      <Link
        to={`/applications/${applicationDetails.get("name")}?namespace=${this.props.activeNamespaceName}`}
        color="inherit">
        <Tooltip title={tooltipTitle} enterDelay={500}>
          <FlexRowItemCenterBox>
            {successCount > 0 ? (
              <FlexRowItemCenterBox mr={1}>
                <SuccessBedge />
                {successCount}
              </FlexRowItemCenterBox>
            ) : null}

            {pendingCount > 0 ? (
              <FlexRowItemCenterBox mr={1}>
                <PendingBedge />
                {pendingCount}
              </FlexRowItemCenterBox>
            ) : null}

            {errorCount > 0 ? (
              <FlexRowItemCenterBox>
                <ErrorBedge />
                {errorCount}
              </FlexRowItemCenterBox>
            ) : null}
          </FlexRowItemCenterBox>
        </Tooltip>
      </Link>
    );
  };

  private renderInternalEndpoints = (applicationDetails: RowData) => {
    let count = 0;

    applicationDetails.get("componentsStatus").forEach(componentStatus => {
      count += componentStatus.get("services").size;
    });

    if (count > 0) {
      return (
        <div>
          <Button
            onClick={() => this.props.dispatch(openDialogAction(internalEndpointsModalID, { applicationDetails }))}
            color="primary">
            {count} Endpoints
          </Button>
        </div>
      );
    } else {
      return "No Endpoints";
    }
  };

  private renderExternalEndpoints = (applicationDetails: RowData) => {
    let count = 0;

    applicationDetails.get("components").forEach(component => {
      if (!component.get("plugins")) {
        return;
      }

      component.get("plugins")!.forEach(plugin => {
        if (plugin.get("type") === EXTERNAL_ACCESS_PLUGIN_TYPE) {
          count += 1;
        }
      });
    });
    if (count > 0) {
      return (
        <div>
          <Button
            onClick={() => this.props.dispatch(openDialogAction(externalEndpointsModalID, { applicationDetails }))}
            color="primary">
            {count} Endpoints
          </Button>
        </div>
      );
    } else {
      return "No Endpoints";
    }
  };

  private renderInternalEndpointsDialog = () => {
    const applicationDetails: RowData = this.props.internalEndpointsDialogData.applicationDetails;
    return (
      <ControlledDialog
        dialogID={internalEndpointsModalID}
        title="Internal Endpoints"
        dialogProps={{
          fullWidth: true,
          maxWidth: "sm"
        }}
        actions={
          <CustomizedButton
            onClick={() => this.props.dispatch(closeDialogAction(internalEndpointsModalID))}
            color="default"
            variant="contained">
            Close
          </CustomizedButton>
        }>
        {applicationDetails
          ? applicationDetails
              .get("componentsStatus")
              .map(componentStatus => {
                return componentStatus.get("services").map(serviceStatus => {
                  const dns = `${serviceStatus.get("name")}.${applicationDetails.get("namespace")}`;
                  return serviceStatus
                    .get("ports")
                    .map(port => {
                      const url = `${dns}:${port.get("port")}`;
                      return <div key={url}>{url}</div>;
                    })
                    .toArray();
                });
              })
              .toArray()
              .flat()
          : null}
      </ControlledDialog>
    );
  };

  private renderExternalEndpointsDialog = () => {
    const applicationDetails: RowData = this.props.externalEndpointsDialogData.applicationDetails;
    return (
      <ControlledDialog
        dialogID={externalEndpointsModalID}
        title="External Endpoints"
        dialogProps={{
          fullWidth: true,
          maxWidth: "sm"
        }}
        actions={
          <CustomizedButton
            onClick={() => this.props.dispatch(closeDialogAction(externalEndpointsModalID))}
            color="default"
            variant="contained">
            Close
          </CustomizedButton>
        }>
        {this.renderExternalEndpointsDialogContent(applicationDetails)}
      </ControlledDialog>
    );
  };

  private renderExternalEndpointsDialogContent = (applicationDetails: RowData) => {
    if (!applicationDetails) {
      return null;
    }

    let urls: string[] = [];
    applicationDetails.get("components").forEach(component => {
      const plugins = component.get("plugins");
      if (!plugins) {
        return;
      }

      plugins.forEach(plugin => {
        if (plugin.get("type") !== EXTERNAL_ACCESS_PLUGIN_TYPE) {
          return;
        }

        const _plugin = plugin as ImmutableMap<ExternalAccessPlugin>;

        const hosts: string[] = _plugin.get("hosts") ? _plugin.get("hosts")!.toArray() : [];
        const paths: string[] = _plugin.get("paths") ? _plugin.get("paths")!.toArray() : ["/"];
        const schema = _plugin.get("enableHttps") ? "https" : "http";
        hosts.forEach(host => {
          paths.forEach(path => {
            const url = `${schema}://${host}${path}`;
            urls.push(url);
          });
        });
      });
    });

    return urls.map(url => (
      <a href={url} key={url}>
        {url}
      </a>
    ));
  };

  private renderActions = (rowData: RowData) => {
    return (
      <FoldButtonGroup
        options={[
          {
            text: "Details",
            to: `/applications/${rowData.get("name")}?namespace=${this.props.activeNamespaceName}`,
            icon: "fullscreen"
          },
          {
            text: "Edit",
            to: `/applications/${rowData.get("name")}/edit?namespace=${this.props.activeNamespaceName}`,
            icon: "edit",
            requiredRole: "writer"
          },
          {
            text: "Duplicate",
            onClick: () => {
              this.showDuplicateConfirmDialog(rowData);
            },
            icon: "file_copy",
            requiredRole: "writer"
          },
          {
            text: "Logs",
            to: `/applications/${rowData.get("name")}/logs?namespace=${this.props.activeNamespaceName}`,
            icon: "view_headline"
          },
          {
            text: "Shell",
            to: `/applications/${rowData.get("name")}/shells?namespace=${this.props.activeNamespaceName}`,
            icon: "play_arrow",
            requiredRole: "writer"
          },
          {
            text: "Delete",
            onClick: () => {
              this.showDeleteConfirmDialog(rowData);
            },
            icon: "delete",
            requiredRole: "writer"
          }
        ]}
      />
    );
  };

  private getData = () => {
    const { applications } = this.props;
    const data = applications
      .map((application, index) => {
        const rowData: any = application;
        // @ts-ignore
        rowData.index = index;
        return rowData as RowData;
      })
      .toArray();
    return data;
  };

  public render() {
    const { classes, isLoading, isFirstLoaded, hasRole } = this.props;
    const components: Components = {};
    const hasWriterRole = hasRole("writer");

    if (hasWriterRole) {
      components.Actions = () => {
        return <AddLink to={`/applications/new?namespace=${this.props.activeNamespaceName}`} />;
      };
    }

    return (
      <BasePage title="Applications">
        {this.renderInternalEndpointsDialog()}
        {this.renderExternalEndpointsDialog()}
        {this.renderDeleteConfirmDialog()}
        {this.renderDuplicateConfirmDialog()}
        {this.renderSwitchingIsActiveConfirmDialog()}
        <div className={classes.root}>
          {isLoading && !isFirstLoaded ? (
            <Loading />
          ) : (
            <MaterialTable
              tableRef={this.tableRef}
              components={components}
              options={{
                padding: "dense",
                draggable: false,
                rowStyle: {
                  verticalAlign: "baseline"
                },
                headerStyle: { color: grey[400] }
              }}
              columns={[
                // @ts-ignore
                { title: "", field: "checkbox", sorting: false, width: "20px", render: this.renderCheckbox },
                { title: "Name", field: "name", sorting: false, render: this.renderName },
                { title: "Status", field: "status", sorting: false, render: this.renderStatus },
                {
                  title: (
                    <Tooltip title="Addresses can be used to access components in each application. Only visible inside the cluster.">
                      <FlexRowItemCenterBox width="auto">
                        Internal Endpoints <HelpIcon fontSize="small" />
                      </FlexRowItemCenterBox>
                    </Tooltip>
                  ),
                  field: "internalEndpoints",
                  sorting: false,
                  render: this.renderInternalEndpoints
                },
                {
                  title: (
                    <Tooltip title="Addresses can be used to access your services publicly.">
                      <FlexRowItemCenterBox width="auto">
                        External Endpoints <HelpIcon fontSize="small" />
                      </FlexRowItemCenterBox>
                    </Tooltip>
                  ),
                  field: "internalEndpoints",
                  sorting: false,
                  render: this.renderExternalEndpoints
                },
                { title: "CPU", field: "cpu", render: this.renderCPU },
                { title: "Memory", field: "memory", render: this.renderMemory },
                { title: "Enable", field: "active", sorting: false, render: this.renderEnable, hidden: !hasWriterRole },
                {
                  title: "Action",
                  field: "action",
                  sorting: false,
                  searchable: false,
                  render: this.renderActions
                }
              ]}
              // detailPanel={this.renderDetails}
              // onRowClick={(_event, _rowData, togglePanel) => {
              //   togglePanel!();
              //   console.log(_event);
              // }}
              data={this.getData()}
              title={TableTitle("Applications")}
            />
          )}
        </div>
        <div className={classes.bottomBar}>
          <div className={classes.bottomContent}>
            <div className={classes.applicationSelected}>
              <div className={classes.selectedNumber}>
                {Object.values(this.state.checkedApplicationNames).filter(Boolean).length}
              </div>{" "}
              Applications Selected
            </div>
            <div className={classes.bottomActions}>
              <div className={classes.bottomAction}>
                <RefreshIcon /> <div className={classes.actionText}> Restart</div>
              </div>
              <div className={classes.bottomAction}>
                <PowerSettingsNewIcon /> <div className={classes.actionText}> Power Off</div>
              </div>
              <div className={classes.bottomAction}>
                <ArchiveIcon /> <div className={classes.actionText}>Archive</div>
              </div>
            </div>
          </div>
        </div>
      </BasePage>
    );
  }
}

export const ApplicationListPage = withStyles(styles)(
  withNamespace(ApplicationListDataWrapper(connect(mapStateToProps)(ApplicationListRaw)))
);
