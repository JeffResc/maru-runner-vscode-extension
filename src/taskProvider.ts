import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MaruTask, MaruTaskFile, MaruTaskDefinition } from './types';
import { findTaskFiles, parseTaskFile } from './extension';

const execAsync = promisify(exec);

export class MaruTaskProvider implements vscode.TaskProvider {
    private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

    private taskFiles: MaruTaskFile[] = [];
    private tasks: vscode.Task[] = [];
    private cachedExecutable: string | null = null;

    constructor() {
        this.refresh();
    }

    private async checkCommandExists(command: string): Promise<boolean> {
        try {
            const checkCommand = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
            await execAsync(checkCommand);
            return true;
        } catch {
            return false;
        }
    }

    private async determineExecutable(): Promise<string> {
        if (this.cachedExecutable) {
            return this.cachedExecutable;
        }

        const config = vscode.workspace.getConfiguration('maru-runner');
        const configuredExecutable = config.get<string>('executable');
        
        if (configuredExecutable) {
            this.cachedExecutable = configuredExecutable;
            return configuredExecutable;
        }

        // Try 'uds run' first, then fallback to 'run'
        const udsExists = await this.checkCommandExists('uds');
        if (udsExists) {
            this.cachedExecutable = 'uds run';
            return 'uds run';
        }

        const runExists = await this.checkCommandExists('run');
        if (runExists) {
            this.cachedExecutable = 'run';
            return 'run';
        }

        // Default to 'run' if neither is found (let the user see the error)
        this.cachedExecutable = 'run';
        return 'run';
    }

    public refresh(): void {
        this.cachedExecutable = null; // Clear cache on refresh
        this._onDidChangeTreeData.fire();
        this.loadTasks();
    }

    private async loadTasks(): Promise<void> {
        const config = vscode.workspace.getConfiguration('maru-runner');
        const autoDetect = config.get<boolean>('autoDetect', true);
        
        if (!autoDetect) {
            return;
        }

        try {
            const taskFilePaths = await findTaskFiles();
            this.taskFiles = [];
            
            for (const filePath of taskFilePaths) {
                const taskFile = await parseTaskFile(filePath);
                if (taskFile) {
                    this.taskFiles.push(taskFile);
                }
            }
            
            this.tasks = [];
            for (const taskFile of this.taskFiles) {
                for (const task of taskFile.tasks) {
                    const vsCodeTask = await this.createVSCodeTask(task, taskFile.path);
                    if (vsCodeTask) {
                        this.tasks.push(vsCodeTask);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading Maru tasks:', error);
            vscode.window.showErrorMessage(`Error loading Maru tasks: ${error}`);
        }
    }

    public async provideTasks(): Promise<vscode.Task[]> {
        return this.tasks;
    }

    public async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
        const definition = task.definition;
        
        if (definition.type === 'maru' && 'task' in definition) {
            return this.createVSCodeTaskFromDefinition(definition as MaruTaskDefinition);
        }
        
        return undefined;
    }

    public async createVSCodeTask(maruTask: MaruTask, filePath?: string): Promise<vscode.Task | null> {
        const finalExecutable = await this.determineExecutable();
        
        const workspaceFolder = this.getWorkspaceFolder(filePath);
        if (!workspaceFolder) {
            return null;
        }
        
        const args = [maruTask.name];
        
        if (filePath) {
            args.push('-f', filePath);
        }
        
        const taskDefinition: MaruTaskDefinition = {
            type: 'maru',
            task: maruTask.name,
            file: filePath,
            args: []
        };
        
        // Split executable in case it contains spaces (like "uds run")
        const executableParts = finalExecutable.split(' ');
        const command = executableParts[0];
        const baseArgs = executableParts.slice(1);
        
        const execution = new vscode.ShellExecution(command, [...baseArgs, ...args], {
            cwd: workspaceFolder.uri.fsPath
        });
        
        const task = new vscode.Task(
            taskDefinition,
            workspaceFolder,
            maruTask.name,
            'maru',
            execution,
            []
        );
        
        // Set task properties
        task.detail = maruTask.description || `Maru task: ${maruTask.name}`;
        task.group = vscode.TaskGroup.Build;
        
        // Add problem matchers for common patterns
        task.problemMatchers = ['$gcc', '$go'];
        
        return task;
    }

    private async createVSCodeTaskFromDefinition(definition: MaruTaskDefinition): Promise<vscode.Task> {
        const finalExecutable = await this.determineExecutable();
        
        const args = [definition.task];
        
        if (definition.file) {
            args.push('-f', definition.file);
        }
        
        if (definition.args) {
            args.push(...definition.args);
        }
        
        const workspaceFolder = this.getWorkspaceFolder(definition.file);
        
        // Split executable in case it contains spaces (like "uds run")
        const executableParts = finalExecutable.split(' ');
        const command = executableParts[0];
        const baseArgs = executableParts.slice(1);
        
        const execution = new vscode.ShellExecution(command, [...baseArgs, ...args], {
            cwd: workspaceFolder?.uri.fsPath
        });
        
        const task = new vscode.Task(
            definition,
            workspaceFolder || vscode.TaskScope.Workspace,
            definition.task,
            'maru',
            execution,
            []
        );
        
        task.group = vscode.TaskGroup.Build;
        task.problemMatchers = ['$gcc', '$go'];
        
        return task;
    }

    private getWorkspaceFolder(filePath?: string): vscode.WorkspaceFolder | undefined {
        if (!filePath) {
            return vscode.workspace.workspaceFolders?.[0];
        }
        
        return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    }

    public getTaskFiles(): MaruTaskFile[] {
        return this.taskFiles;
    }

    public getTasksForFile(filePath: string): MaruTask[] {
        const taskFile = this.taskFiles.find(tf => tf.path === filePath);
        return taskFile?.tasks || [];
    }

    public async getTaskDescription(task: MaruTask): Promise<string> {
        let description = task.description || '';
        
        if (task.actions.length > 0) {
            const actionSummary = task.actions.map(action => {
                if (action.cmd) {
                    return `cmd: ${action.cmd}`;
                } else if (action.task) {
                    return `task: ${action.task}`;
                }
                return 'action';
            }).join(', ');
            
            if (description) {
                description += ` (${actionSummary})`;
            } else {
                description = actionSummary;
            }
        }
        
        return description;
    }
}
