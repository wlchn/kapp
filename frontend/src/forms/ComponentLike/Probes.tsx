import { MenuItem, Grid, Divider, Hidden } from "@material-ui/core";
import Immutable from "immutable";
import React from "react";
import { connect, DispatchProp } from "react-redux";
import { WrappedFieldProps } from "redux-form";
import { Field } from "redux-form/immutable";
import { HttpHeaders, HttpHeader } from "../../types/componentTemplate";
import { CustomTextField, RenderSelectField } from "../Basic";
import { ValidatorRequired, ValidatorHttpHeaders, ValidatorNumberOrAlphabet } from "../validator";
import { NormalizeNumber, NormalizeNumberOrAlphabet } from "forms/normalizer";
import { SectionTitle } from "widgets/SectionTitle";

interface FieldComponentHackType {
  name: any;
  component: any;
  label: any;
}

interface FieldProps extends DispatchProp {}

interface Props extends WrappedFieldProps, FieldComponentHackType, FieldProps {}

interface State {
  type: string;
}

class RenderProbe extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      type: ""
    };
  }

  public componentDidMount() {
    const input = this.props.input;
    const value = this.props.input.value;

    // console.log(value.get && value.get("httpGet") && value.get("httpGet").toJS());

    // if have get method
    if (value.get) {
      if (value.get("httpGet")) {
        this.setState({ type: "httpGet" });
        input.onChange(value.set("type", "httpGet"));
      } else if (value.get("exec")) {
        this.setState({ type: "exec" });
        input.onChange(value.set("type", "exec"));
      } else if (value.get("tcpSocket")) {
        this.setState({ type: "tcpSocket" });
        input.onChange(value.set("type", "tcpSocket"));
      }
    }
  }

  private handleChangeType(type: string) {
    const input = this.props.input;
    const value = this.props.input.value;
    this.setState({ type });

    if (value.delete) {
      if (type === "httpGet") {
        input.onChange(value.delete("exec").delete("tcpSocket"));
      } else if (type === "exec") {
        input.onChange(value.delete("httpGet").delete("tcpSocket"));
      } else if (type === "tcpSocket") {
        input.onChange(value.delete("httpGet").delete("exec"));
      } else {
        input.onChange(
          value
            .delete("httpGet")
            .delete("exec")
            .delete("tcpSocket")
        );
      }
    }
  }

  private renderHttpGet() {
    const name = this.props.input.name;
    return (
      <>
        <Grid item md={10}>
          <CustomTextField name={`${name}.httpGet.host`} label="Host (Optional)" margin helperText="" />
        </Grid>
        <Grid item md={10}>
          <CustomTextField
            name={`${name}.httpGet.port`}
            label="Port"
            margin
            helperText=""
            validate={[ValidatorRequired]}
            normalize={NormalizeNumber}
          />
        </Grid>
        <Grid item md={10}>
          <CustomTextField name={`${name}.httpGet.path`} label="Path (Optional)" margin helperText="" />
        </Grid>
        <Grid item md={10}>
          <CustomTextField name={`${name}.httpGet.scheme`} label="Scheme (Optional)" margin helperText="" />
        </Grid>
        <Grid item md={10}>
          <CustomTextField
            name={`${name}.httpGet.httpHeaders`}
            label="httpHeaders (Optional)"
            margin
            helperText='Eg: {"name1": "value1", "name2": "value2"}'
            validate={[ValidatorHttpHeaders]}
            formValueToEditValue={(value: HttpHeaders) => {
              if (!value) {
                return "";
              }

              if (typeof value === "string") {
                return value;
              }

              const json: { [key: string]: string } = {};
              value.forEach(httpHeader => {
                json[httpHeader.get("name")] = httpHeader.get("value");
              });

              return JSON.stringify(json);
            }}
            editValueToFormValue={(value: any) => {
              if (!value) {
                // Optional field
                return undefined;
              }

              const httpHeaders: HttpHeader[] = [];
              let json;
              try {
                json = JSON.parse(value);
              } catch (e) {
                // for validate
                return value;
              }
              for (const key in json) {
                httpHeaders.push(
                  Immutable.Map({
                    name: key,
                    value: json[key]
                  })
                );
              }

              return Immutable.List(httpHeaders);
            }}
          />
        </Grid>
      </>
    );
  }
  private renderExec() {
    const name = this.props.input.name;
    return (
      <Grid item xs={12} sm={12} md={10}>
        <CustomTextField
          name={`${name}.exec.command`}
          label="Command (Optional)"
          margin
          helperText='Eg: "/bin/app", "rails server".'
          formValueToEditValue={(value: Immutable.List<string>) => {
            return value && value.toArray && value.toArray().join(" ") ? value.toArray().join(" ") : "";
          }}
          editValueToFormValue={(value: any) => {
            let inputList = value.split(",");
            inputList = inputList.map((item: string) => {
              item = item.replace(/"/g, "");
              return item.trim();
            });
            return inputList && inputList.length > 0 ? Immutable.List(inputList) : Immutable.List([]);
          }}
        />
      </Grid>
    );
  }

  private renderTcpSocket() {
    const name = this.props.input.name;
    return (
      <>
        <Grid item md={10}>
          <CustomTextField name={`${name}.tcpSocket.host`} label="Host (Optional)" margin helperText="" />
        </Grid>
        <Grid item md={10}>
          <CustomTextField
            name={`${name}.tcpSocket.port`}
            label="Port"
            margin
            helperText=""
            validate={[ValidatorRequired, ValidatorNumberOrAlphabet]}
            normalize={NormalizeNumberOrAlphabet}
          />
        </Grid>
      </>
    );
  }

  private renderCommon() {
    const name = this.props.input.name;

    return (
      <>
        {SectionTitle("Optionals")}
        <Grid item md={10}>
          <CustomTextField
            name={`${name}.initialDelaySeconds`}
            label="InitialDelaySeconds (Optional)"
            normalize={NormalizeNumber}
            margin
            helperText=""
          />
        </Grid>
        <Grid item md={10}>
          <CustomTextField
            name={`${name}.timeoutSeconds`}
            label="TimeoutSeconds (Optional)"
            normalize={NormalizeNumber}
            margin
            helperText=""
          />
        </Grid>
        <Grid item md={10}>
          <CustomTextField
            name={`${name}.periodSeconds`}
            label="PeriodSeconds (Optional)"
            normalize={NormalizeNumber}
            margin
            helperText=""
          />
        </Grid>
        <Grid item md={10}>
          <CustomTextField
            name={`${name}.successThreshold`}
            label="SuccessThreshold (Optional)"
            normalize={NormalizeNumber}
            margin
            helperText=""
          />
        </Grid>
        <Grid item md={10}>
          <CustomTextField
            name={`${name}.failureThreshold`}
            label="FailureThreshold (Optional)"
            normalize={NormalizeNumber}
            margin
            helperText=""
          />
        </Grid>
      </>
    );
  }

  public render() {
    // console.log(this.props);
    const { type } = this.state;
    const { label } = this.props;
    const name = this.props.input.name;

    return (
      <Grid container spacing={2}>
        <Grid item xs={12} sm={12} md={12}>
          {SectionTitle(label)}
        </Grid>

        <Grid item xs={12} sm={6} md={6}>
          <Grid item xs={12} sm={12} md={10}>
            <Field
              name={`${name}.type`}
              component={RenderSelectField}
              label="Type"
              value={type}
              onChange={(value: any) => {
                this.handleChangeType(value);
              }}>
              <MenuItem value={""}>none</MenuItem>
              <MenuItem value={"httpGet"}>httpGet</MenuItem>
              <MenuItem value={"exec"}>exec</MenuItem>
              <MenuItem value={"tcpSocket"}>tcpSocket</MenuItem>
            </Field>
          </Grid>
          {type === "httpGet" && this.renderHttpGet()}
          {type === "exec" && this.renderExec()}
          {type === "tcpSocket" && this.renderTcpSocket()}
        </Grid>
        <Hidden only={["xs"]}>
          <Grid item md={1}>
            {type !== "" && <Divider orientation="vertical" />}
          </Grid>
        </Hidden>
        <Grid item xs={12} sm={5} md={5}>
          {type !== "" && this.renderCommon()}
        </Grid>
      </Grid>
    );
  }
}

export const LivenessProbe = connect()((props: FieldProps) => {
  return <Field name="livenessProbe" label="LivenessProbe" component={RenderProbe} {...props} />;
});

export const ReadinessProbe = connect()((props: FieldProps) => {
  return <Field name="readinessProbe" label="ReadinessProbe" component={RenderProbe} {...props} />;
});
