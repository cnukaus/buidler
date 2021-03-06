import {
  ActionType,
  ParamDefinition,
  ParamDefinitionsMap,
  TaskArguments,
  TaskDefinition
} from "../../../types";
import { BuidlerError, ERRORS } from "../errors";
import * as types from "../params/argumentTypes";
import { BUIDLER_PARAM_DEFINITIONS } from "../params/buidler-params";

export class SimpleTaskDefinition implements TaskDefinition {
  get description() {
    return this._description;
  }
  public readonly paramDefinitions: ParamDefinitionsMap = {};
  public readonly positionalParamDefinitions: Array<ParamDefinition<any>> = [];
  public action: ActionType<TaskArguments>;

  private _positionalParamNames: Set<string>;
  private _hasVariadicParam: boolean;
  private _hasOptionalPositionalParam: boolean;
  private _description?: string;

  constructor(
    public readonly name: string,
    public readonly isInternal: boolean = false
  ) {
    this._positionalParamNames = new Set();
    this._hasVariadicParam = false;
    this._hasOptionalPositionalParam = false;
    this.action = () => {
      throw new BuidlerError(ERRORS.TASK_DEFINITIONS.ACTION_NOT_SET, name);
    };
  }

  public setDescription(description: string) {
    this._description = description;
    return this;
  }

  public setAction<ArgsT>(action: ActionType<ArgsT>) {
    // TODO: There's probably something bad here. See types.ts for more info.
    this.action = action as ActionType<TaskArguments>;
    return this;
  }

  public addParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>,
    isOptional: boolean = defaultValue !== undefined
  ): this {
    if (type === undefined) {
      if (defaultValue !== undefined && typeof defaultValue !== "string") {
        throw new BuidlerError(
          ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE,
          name,
          this.name
        );
      }

      return this.addParam(
        name,
        description,
        defaultValue,
        types.string,
        isOptional
      );
    }

    this._validateNameNotUsed(name);
    this._validateNoDefaultValueForMandatoryParam(
      defaultValue,
      isOptional,
      name
    );

    this.paramDefinitions[name] = {
      name,
      defaultValue,
      type,
      description,
      isOptional,
      isFlag: false,
      isVariadic: false
    };

    return this;
  }

  public addOptionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>
  ): this {
    return this.addParam(name, description, defaultValue, type, true);
  }

  public addFlag(name: string, description?: string) {
    this._validateNameNotUsed(name);

    this.paramDefinitions[name] = {
      name,
      defaultValue: false,
      type: types.boolean,
      description,
      isFlag: true,
      isOptional: true,
      isVariadic: false
    };

    return this;
  }

  public addPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>,
    isOptional = defaultValue !== undefined
  ): this {
    if (type === undefined) {
      if (defaultValue !== undefined && typeof defaultValue !== "string") {
        throw new BuidlerError(
          ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE,
          name,
          this.name
        );
      }

      return this.addPositionalParam(
        name,
        description,
        defaultValue,
        types.string,
        isOptional
      );
    }

    this._validateNameNotUsed(name);
    this._validateNotAfterVariadicParam(name);
    this._validateNoMandatoryParamAfterOptionalOnes(name, isOptional);
    this._validateNoDefaultValueForMandatoryParam(
      defaultValue,
      isOptional,
      name
    );

    const definition = {
      name,
      defaultValue,
      type,
      description,
      isVariadic: false,
      isOptional,
      isFlag: false
    };

    this._addPositionalParamDefinition(definition);

    return this;
  }

  public addOptionalPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>
  ): this {
    return this.addPositionalParam(name, description, defaultValue, type, true);
  }

  public addVariadicPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T[] | T,
    type?: types.ArgumentType<T>,
    isOptional = defaultValue !== undefined
  ): this {
    if (defaultValue !== undefined && !Array.isArray(defaultValue)) {
      defaultValue = [defaultValue];
    }

    if (type === undefined) {
      if (defaultValue !== undefined && !this.isStringArray(defaultValue)) {
        throw new BuidlerError(
          ERRORS.TASK_DEFINITIONS.DEFAULT_VALUE_WRONG_TYPE,
          name,
          this.name
        );
      }

      return this.addVariadicPositionalParam(
        name,
        description,
        defaultValue,
        types.string,
        isOptional
      );
    }

    this._validateNameNotUsed(name);
    this._validateNotAfterVariadicParam(name);
    this._validateNoMandatoryParamAfterOptionalOnes(name, isOptional);
    this._validateNoDefaultValueForMandatoryParam(
      defaultValue,
      isOptional,
      name
    );

    const definition = {
      name,
      defaultValue,
      type,
      description,
      isVariadic: true,
      isOptional,
      isFlag: false
    };

    this._addPositionalParamDefinition(definition);

    return this;
  }

  public addOptionalVariadicPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T[] | T,
    type?: types.ArgumentType<T>
  ): this {
    return this.addVariadicPositionalParam(
      name,
      description,
      defaultValue,
      type,
      true
    );
  }

  public _addPositionalParamDefinition(definition: ParamDefinition<any>) {
    if (definition.isVariadic) {
      this._hasVariadicParam = true;
    }

    if (definition.isOptional) {
      this._hasOptionalPositionalParam = true;
    }

    this._positionalParamNames.add(definition.name);
    this.positionalParamDefinitions.push(definition);
  }

  public _validateNotAfterVariadicParam(name: string) {
    if (this._hasVariadicParam) {
      throw new BuidlerError(
        ERRORS.TASK_DEFINITIONS.PARAM_AFTER_VARIADIC,
        name,
        this.name
      );
    }
  }

  public _validateNameNotUsed(name: string) {
    if (this._hasParamDefined(name)) {
      throw new BuidlerError(
        ERRORS.TASK_DEFINITIONS.PARAM_ALREADY_DEFINED,
        name,
        this.name
      );
    }

    if (Object.keys(BUIDLER_PARAM_DEFINITIONS).includes(name)) {
      throw new BuidlerError(
        ERRORS.TASK_DEFINITIONS.PARAM_CLASHES_WITH_BUIDLER_PARAM,
        name,
        this.name
      );
    }
  }

  public _hasParamDefined(name: string) {
    return (
      this.paramDefinitions[name] !== undefined ||
      this._positionalParamNames.has(name)
    );
  }

  public _validateNoMandatoryParamAfterOptionalOnes(
    name: string,
    isOptional: boolean
  ) {
    if (!isOptional && this._hasOptionalPositionalParam) {
      throw new BuidlerError(
        ERRORS.TASK_DEFINITIONS.MANDATORY_PARAM_AFTER_OPTIONAL,
        name,
        this.name
      );
    }
  }

  private _validateNoDefaultValueForMandatoryParam(
    defaultValue: any | undefined,
    isOptional: boolean,
    name: string
  ) {
    if (defaultValue !== undefined && !isOptional) {
      throw new BuidlerError(
        ERRORS.TASK_DEFINITIONS.DEFAULT_IN_MANDATORY_PARAM,
        name,
        this.name
      );
    }
  }

  private isStringArray(values: any): values is string[] {
    return Array.isArray(values) && values.every(v => typeof v === "string");
  }
}

export class OverriddenTaskDefinition implements TaskDefinition {
  private _description?: string;
  private _action?: ActionType<TaskArguments>;

  constructor(
    public readonly parentTaskDefinition: TaskDefinition,
    public readonly isInternal: boolean = false
  ) {
    this.isInternal = isInternal;
    this.parentTaskDefinition = parentTaskDefinition;
  }

  public setDescription(description: string) {
    this._description = description;
    return this;
  }

  public setAction<ArgsT>(action: ActionType<ArgsT>) {
    // TODO: There's probably something bad here. See types.ts for more info.
    this._action = action as ActionType<TaskArguments>;
    return this;
  }

  get name() {
    return this.parentTaskDefinition.name;
  }

  get description() {
    if (this._description !== undefined) {
      return this._description;
    }

    return this.parentTaskDefinition.description;
  }

  get action() {
    if (this._action !== undefined) {
      return this._action;
    }

    return this.parentTaskDefinition.action;
  }

  get paramDefinitions() {
    return this.parentTaskDefinition.paramDefinitions;
  }

  get positionalParamDefinitions() {
    return this.parentTaskDefinition.positionalParamDefinitions;
  }

  public addParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>,
    isOptional?: boolean
  ): this {
    return this._throwNoParamsOverrideError();
  }

  public addOptionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>
  ): this {
    return this._throwNoParamsOverrideError();
  }

  public addPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>,
    isOptional?: boolean
  ): this {
    return this._throwNoParamsOverrideError();
  }

  public addOptionalPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>
  ): this {
    return this._throwNoParamsOverrideError();
  }

  public addVariadicPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T[],
    type?: types.ArgumentType<T>,
    isOptional?: boolean
  ): this {
    return this._throwNoParamsOverrideError();
  }

  public addOptionalVariadicPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T[],
    type?: types.ArgumentType<T>
  ): this {
    return this._throwNoParamsOverrideError();
  }

  public addFlag(name: string, description?: string): this {
    return this._throwNoParamsOverrideError();
  }

  public _throwNoParamsOverrideError(): never {
    throw new BuidlerError(
      ERRORS.TASK_DEFINITIONS.OVERRIDE_NO_PARAMS,
      this.name
    );
  }
}
