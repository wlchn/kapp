import { createStyles, Theme, withStyles, WithStyles } from "@material-ui/core/styles";
import React from "react";
import { TabBarComponent } from "./TabBar";
import { RootState } from "reducers";
import { connect } from "react-redux";
import { RequireAuthorizated } from "permission/Authorization";

const styles = (theme: Theme) => {
  return createStyles({
    root: {
      // display: "flex",
      height: "100%"
    },
    content: {
      flexGrow: 1,
      paddingTop: "128px",
      // height: "100%",
      // maxWidth: "1200px",
      margin: "0 auto"
    }
  });
};

const mapStateToProps = (state: RootState) => {
  return {
    activeNamespaceName: state.get("namespaces").get("active")
  };
};

interface Props extends WithStyles<typeof styles>, React.Props<any>, ReturnType<typeof mapStateToProps> {}

class DashboardRaw extends React.PureComponent<Props> {
  render() {
    const { classes, children, activeNamespaceName } = this.props;
    return (
      <div className={classes.root}>
        <TabBarComponent
          tabOptions={[
            {
              text: "Namespaces",
              to: "/namespaces",
              requireAdmin: true
            },
            {
              text: "Roles & Permissions",
              to: "/roles",
              requireAdmin: true
            },
            {
              text: "Applications",
              to: "/applications?namespace=" + activeNamespaceName
            },
            {
              text: "Configs",
              to: "/configs?namespace=" + activeNamespaceName
            },
            {
              text: "Nodes",
              to: "/cluster/nodes"
            },
            {
              text: "Volumes",
              to: "/cluster/volumes"
            }
          ]}
          title="OpenCore Kapp"
          key={activeNamespaceName}
        />
        <main className={classes.content}>{children}</main>
      </div>
    );
  }
}

export const Dashboard = withStyles(styles)(RequireAuthorizated(connect(mapStateToProps)(DashboardRaw)));
