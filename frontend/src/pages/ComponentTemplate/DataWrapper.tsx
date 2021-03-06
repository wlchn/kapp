import React from "react";
import { RootState } from "../../reducers";
import { connect } from "react-redux";
import { loadComponentTemplatesAction } from "../../actions/componentTemplate";
import { ThunkDispatch } from "redux-thunk";
import { Actions } from "../../types";

const mapStateToProps = (state: RootState) => {
  const componentTemplatesState = state.get("componentTemplates");
  return {
    componentTemplates: componentTemplatesState.get("componentTemplates").toList(),
    isLoading: componentTemplatesState.get("isListLoading"),
    isFirstLoaded: componentTemplatesState.get("isListFirstLoaded")
  };
};

export interface WithComponentTemplatesDataProps extends ReturnType<typeof mapStateToProps> {
  dispatch: ThunkDispatch<RootState, undefined, Actions>;
}

export const ComponentTemplateDataWrapper = (WrappedComponent: React.ComponentType<any>) => {
  const WithComponentTemplatesData: React.ComponentType<WithComponentTemplatesDataProps> = class extends React.Component<
    WithComponentTemplatesDataProps
  > {
    private interval?: number;

    private loadData = () => {
      this.props.dispatch(loadComponentTemplatesAction());
      // this.interval = window.setTimeout(this.loadData, 5000);
    };

    componentDidMount() {
      this.loadData();
    }

    componentWillUnmount() {
      if (this.interval) {
        window.clearTimeout(this.interval);
      }
    }

    render() {
      return <WrappedComponent {...this.props} />;
    }
  };

  WithComponentTemplatesData.displayName = `WithComponentTemplatesData(${getDisplayName(WrappedComponent)})`;

  return connect(mapStateToProps)(WithComponentTemplatesData);
};

function getDisplayName(WrappedComponent: React.ComponentType) {
  return WrappedComponent.displayName || WrappedComponent.name || "Component";
}
