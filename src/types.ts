import * as vscode from 'vscode';

export interface MaruVariable {
    name: string;
    default?: string;
    sensitive?: boolean;
}

export interface MaruAction {
    cmd?: string;
    task?: string;
    description?: string;
    mute?: boolean;
    dir?: string;
    env?: string[];
    maxRetries?: number;
    maxTotalSeconds?: number;
    setVariables?: Array<{ name: string }>;
    wait?: MaruWait;
}

export interface MaruWait {
    network?: {
        protocol: string;
        address: string;
        code: number;
    };
    cluster?: {
        kind: string;
        name: string;
        namespace: string;
    };
}

export interface MaruTaskInput {
    description?: string;
    required?: boolean;
    default?: string;
    deprecatedMessage?: string;
}

export interface MaruTask {
    name: string;
    description?: string;
    actions: MaruAction[];
    inputs?: Record<string, MaruTaskInput>;
    envPath?: string;
    wait?: MaruWait;
}

export interface MaruInclude {
    local?: string;
    remote?: string;
}

export interface MaruTaskFile {
    path: string;
    variables: MaruVariable[];
    tasks: MaruTask[];
    includes: MaruInclude[];
}

export interface MaruTaskDefinition extends vscode.TaskDefinition {
    type: 'maru';
    task: string;
    file?: string;
    args?: string[];
}
