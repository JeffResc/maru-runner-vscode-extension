import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

interface SchemaCache {
    schema: any;
    version: string;
    timestamp: number;
}

export class SchemaValidator {
    private static instance: SchemaValidator;
    private cache: SchemaCache | null = null;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    private constructor() {}

    public static getInstance(): SchemaValidator {
        if (!SchemaValidator.instance) {
            SchemaValidator.instance = new SchemaValidator();
        }
        return SchemaValidator.instance;
    }

    private async fetchSchema(version: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const url = `https://raw.githubusercontent.com/defenseunicorns/maru-runner/refs/heads/${version}/tasks.schema.json`;
            
            const client = url.startsWith('https:') ? https : http;
            
            client.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to fetch schema: HTTP ${response.statusCode}`));
                    return;
                }

                let data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    try {
                        const schema = JSON.parse(data);
                        resolve(schema);
                    } catch (error) {
                        reject(new Error(`Failed to parse schema JSON: ${error}`));
                    }
                });
            }).on('error', (error) => {
                reject(new Error(`Failed to fetch schema: ${error.message}`));
            });
        });
    }

    private async getSchema(): Promise<any> {
        const config = vscode.workspace.getConfiguration('maru-runner');
        const version = config.get<string>('schemaVersion', 'main');
        
        // Check if we have a valid cached schema
        if (this.cache && 
            this.cache.version === version && 
            Date.now() - this.cache.timestamp < this.CACHE_DURATION) {
            return this.cache.schema;
        }

        try {
            const schema = await this.fetchSchema(version);
            this.cache = {
                schema,
                version,
                timestamp: Date.now()
            };
            return schema;
        } catch (error) {
            console.error('Failed to fetch maru-runner schema:', error);
            throw error;
        }
    }

    public async validateTaskFile(content: any): Promise<boolean> {
        try {
            const schema = await this.getSchema();
            
            // Basic validation - check for required structure
            if (!content || typeof content !== 'object') {
                return false;
            }

            // Check for required 'tasks' property
            if (!content.tasks || !Array.isArray(content.tasks)) {
                return false;
            }

            // Check that tasks have required 'name' property
            for (const task of content.tasks) {
                if (!task || typeof task !== 'object' || !task.name || typeof task.name !== 'string') {
                    return false;
                }
            }

            // Additional validation - check for other schema-specific properties
            // This is a simplified validation - in a production environment, you'd want
            // to use a proper JSON schema validator like ajv
            
            // Validate task structure
            for (const task of content.tasks) {
                // Actions should be an array if present
                if (task.actions && !Array.isArray(task.actions)) {
                    return false;
                }
                
                // Inputs should be an object if present
                if (task.inputs && typeof task.inputs !== 'object') {
                    return false;
                }
            }

            // Validate top-level optional properties
            if (content.variables && !Array.isArray(content.variables)) {
                return false;
            }

            if (content.includes && !Array.isArray(content.includes)) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Schema validation failed:', error);
            return false;
        }
    }

    public clearCache(): void {
        this.cache = null;
    }
}