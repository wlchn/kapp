import { FilledTextFieldProps } from "@material-ui/core/TextField";
import Cascader from "antd/es/cascader";
import "antd/es/cascader/style/css";
import React from "react";
import { WrappedFieldProps } from "redux-form";
import { Field } from "redux-form/immutable";
import { pathToAncestorIds } from "../../actions/config";
import { getCascaderOptions, getConfigFilePaths } from "../../selectors/config";
import { ValidatorRequired } from "../validator";
import { EditComponentProps } from "material-table";
import Checkbox from "@material-ui/core/Checkbox";
import TextField from "@material-ui/core/TextField";
import Autocomplete from "@material-ui/lab/Autocomplete";
import CheckBoxOutlineBlankIcon from "@material-ui/icons/CheckBoxOutlineBlank";
import CheckBoxIcon from "@material-ui/icons/CheckBox";

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" color="primary" />;

export const cascaderValueToPath = (value: string[]): string => {
  let path = "";
  for (let i = 1; i <= value.length - 1; i++) {
    path = path + "/" + value[i];
  }
  return path;
};

export const pathToCasCaderValue = (path: string): string[] => {
  let defaultValue;
  const ancestorIds = pathToAncestorIds(path);
  const splits = path.split("/");
  const configName = splits[splits.length - 1];
  ancestorIds.push(configName);
  defaultValue = ancestorIds;
  return defaultValue;
};

const displayRender = (labels: any, selectedOptions: any) => {
  return labels.map((label: any, i: any) => {
    const option = selectedOptions[i];
    if (label === "/") {
      return <span key={option.value}></span>;
    }
    return <span key={option.value}>/ {label} </span>;
  });
};

const renderKappConfigPath = ({ input, meta: { touched, error } }: FilledTextFieldProps & WrappedFieldProps) => {
  let defaultValue;
  if (input.value) {
    defaultValue = pathToCasCaderValue(input.value);
  }

  return (
    <Cascader
      placeholder={"Kapp Config Path"}
      options={getCascaderOptions(false)}
      displayRender={displayRender}
      style={{ width: "100%" }}
      allowClear={false}
      defaultValue={defaultValue}
      onChange={(value: string[]) => {
        input.onChange(cascaderValueToPath(value));
      }}></Cascader>
  );
};

export const SelectKappConfigPath = (props: any) => {
  return <Field name="kappConfigPath" component={renderKappConfigPath} validate={ValidatorRequired} />;
};

export const MaterialTableEditVolumeConfigField = ({ value, onChange }: EditComponentProps<{}>) => {
  let defaultValue;
  if (value) {
    defaultValue = pathToCasCaderValue(value);
  }

  return (
    <Cascader
      placeholder={"Kapp Config Path"}
      options={getCascaderOptions(false)}
      displayRender={displayRender}
      style={{ width: "100%" }}
      allowClear={false}
      defaultValue={defaultValue}
      onChange={(value: string[]) => {
        onChange(cascaderValueToPath(value));
      }}></Cascader>
  );
};

export const MaterialTableEditConfigField = ({ value, onChange }: EditComponentProps<{}>) => {
  return (
    <Autocomplete
      multiple
      options={getConfigFilePaths()}
      disableCloseOnSelect
      getOptionLabel={option => option}
      renderOption={(option, { selected }) => (
        <React.Fragment>
          <Checkbox icon={icon} checkedIcon={checkedIcon} style={{ marginRight: 8 }} checked={selected} />
          {option}
        </React.Fragment>
      )}
      renderInput={params => (
        <TextField
          {...params}
          variant="outlined"
          label="Node Selector Labels"
          placeholder="Select Node Selector Labels"
          size={"small"}
        />
      )}
      defaultValue={value}
      onChange={(_, v: any) => {
        const value = v as string[];

        onChange(value);
      }}
    />
  );
};
