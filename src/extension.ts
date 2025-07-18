import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';
import { MaruTaskProvider } from './taskProvider';
import { MaruCodeLensProvider } from './codeLensProvider';
import { MaruTask, MaruTaskFile } from './types';
import { SchemaValidator } from './schemaValidator';

export function activate(context: vscode.ExtensionContext) {
    console.log('Maru Runner extension is now active!');

    // Register task provider
    const taskProvider = new MaruTaskProvider();
    const taskProviderDisposable = vscode.tasks.registerTaskProvider('maru', taskProvider);

    // Register code lens provider for all YAML files
    const codeLensProvider = new MaruCodeLensProvider();
    const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
        [
            { pattern: '**/*.{yaml,yml}' }
        ],
        codeLensProvider
    );

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('maru-runner.refreshTasks', () => {
        taskProvider.refresh();
        vscode.window.showInformationMessage('Maru tasks refreshed');
    });

    const runTaskFromFileCommand = vscode.commands.registerCommand('maru-runner.runTaskFromFile', 
        async (taskName: string, filePath: string) => {
            const executable = await taskProvider.determineExecutable();
            const args = [taskName, '-f', filePath];
            const executableParts = executable.split(' ');
            const command = executableParts[0];
            const baseArgs = executableParts.slice(1);
            
            const terminal = vscode.window.createTerminal({
                name: `Maru: ${taskName}`,
                cwd: vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))?.uri.fsPath
            });
            
            terminal.sendText(`${command} ${[...baseArgs, ...args].join(' ')}`);
            terminal.show();
        }
    );


    // Watch for changes in all YAML files
    const yamlFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{yaml,yml}');
    
    const refreshBoth = () => {
        taskProvider.refresh();
        codeLensProvider.refresh();
    };
    
    yamlFileWatcher.onDidChange(refreshBoth);
    yamlFileWatcher.onDidCreate(refreshBoth);
    yamlFileWatcher.onDidDelete(refreshBoth);

    // Auto-detect tasks on startup
    if (vscode.workspace.workspaceFolders) {
        taskProvider.refresh();
    }

    context.subscriptions.push(
        taskProviderDisposable,
        codeLensProviderDisposable,
        refreshCommand,
        runTaskFromFileCommand,
        yamlFileWatcher
    );
}

export function deactivate() {}

export async function findTaskFiles(): Promise<string[]> {
    const foundFiles: string[] = [];
    const validator = SchemaValidator.getInstance();
    
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            // Search for all YAML files in the workspace
            const yamlPattern = new vscode.RelativePattern(folder, '**/*.{yaml,yml}');
            const yamlFiles = await vscode.workspace.findFiles(yamlPattern);
            
            for (const file of yamlFiles) {
                try {
                    const content = fs.readFileSync(file.fsPath, 'utf8');
                    const parsed = yaml.parse(content);
                    
                    // Validate against maru-runner schema
                    if (await validator.validateTaskFile(parsed)) {
                        foundFiles.push(file.fsPath);
                    }
                } catch (error) {
                    // Skip files that can't be parsed or validated
                    continue;
                }
            }
        }
    }
    
    return foundFiles;
}

export async function parseTaskFile(filePath: string): Promise<MaruTaskFile | null> {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = yaml.parse(content);
        
        // Validate against maru-runner schema
        const validator = SchemaValidator.getInstance();
        if (!(await validator.validateTaskFile(parsed))) {
            return null;
        }
        
        return {
            path: filePath,
            variables: parsed.variables || [],
            tasks: parsed.tasks.map((task: any) => ({
                name: task.name,
                description: task.description || '',
                actions: task.actions || [],
                inputs: task.inputs || {},
                envPath: task.envPath,
                wait: task.wait
            })),
            includes: parsed.includes || []
        };
    } catch (error) {
        console.error(`Error parsing task file ${filePath}:`, error);
        return null;
    }
}
