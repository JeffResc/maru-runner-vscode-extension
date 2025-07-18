import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { MaruTask } from './types';
import { SchemaValidator } from './schemaValidator';

export class MaruCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        const fileName = document.fileName.toLowerCase();
        
        // Only process YAML files
        if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        
        try {
            const content = document.getText();
            const parsed = yaml.parse(content);
            
            // Validate against maru-runner schema
            const validator = SchemaValidator.getInstance();
            if (!(await validator.validateTaskFile(parsed))) {
                return [];
            }

            const lines = content.split('\n');
            let currentLine = 0;
            
            for (const task of parsed.tasks) {
                if (!task.name) {
                    continue;
                }
                
                const taskNameLine = this.findTaskNameLine(lines, task.name, currentLine);
                if (taskNameLine >= 0) {
                    const range = new vscode.Range(taskNameLine, 0, taskNameLine, 0);
                    
                    const runCommand: vscode.Command = {
                        title: `▶️ Run ${task.name}`,
                        command: 'maru-runner.runTaskFromFile',
                        arguments: [task.name, document.fileName]
                    };
                    
                    codeLenses.push(new vscode.CodeLens(range, runCommand));
                    currentLine = taskNameLine + 1;
                }
            }
        } catch (error) {
            console.error('Error parsing tasks file for code lens:', error);
        }

        return codeLenses;
    }

    private findTaskNameLine(lines: string[], taskName: string, startLine: number): number {
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(`name: ${taskName}`) || line.includes(`name: "${taskName}"`) || line.includes(`name: '${taskName}'`)) {
                return i;
            }
        }
        return -1;
    }
}