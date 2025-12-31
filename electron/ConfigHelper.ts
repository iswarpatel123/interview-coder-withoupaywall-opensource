// ConfigHelper.ts
import { app } from "electron"
import { EventEmitter } from "events"
import fs from "node:fs"
import path from "node:path"
import { OpenAI } from "openai"

interface Config {
  aiApiKey: string;
  aiEndpoint: string;
  aiModel: string;
  language: string;
  opacity: number;
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    aiApiKey: "",
    aiEndpoint: "https://api.openai.com/v1",
    aiModel: "gpt-4o",
    language: "python",
    opacity: 1.0
  };

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }

    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(configData);

        return {
          ...this.defaultConfig,
          ...config
        };
      }

      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    } catch (err) {
      console.error("Error loading config:", err);
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write the config file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();
      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);

      // Emit update event for config changes
      this.emit('config-updated', newConfig);

      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Check if any API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return !!(config.aiApiKey && config.aiApiKey.trim().length > 0);
  }

  /**
   * Check if extraction API key is configured (deprecated, uses unified AI key)
   */
  public hasExtractionApiKey(): boolean {
    const config = this.loadConfig();
    return !!(config.aiApiKey && config.aiApiKey.trim().length > 0);
  }

  /**
   * Check if solution API key is configured (deprecated, uses unified AI key)
   */
  public hasSolutionApiKey(): boolean {
    const config = this.loadConfig();
    return !!(config.aiApiKey && config.aiApiKey.trim().length > 0);
  }

  /**
   * Check if debugging API key is configured (deprecated, uses unified AI key)
   */
  public hasDebuggingApiKey(): boolean {
    const config = this.loadConfig();
    return !!(config.aiApiKey && config.aiApiKey.trim().length > 0);
  }

  /**
   * Validate API key format (basic validation)
   */
  public isValidApiKeyFormat(apiKey: string): boolean {
    // Basic format validation for OpenAI API keys
    return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
  }

  /**
   * Test API key with OpenAI
   */
  public async testApiKey(apiKey: string): Promise<{ valid: boolean, error?: string }> {
    try {
      const openai = new OpenAI({ apiKey });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('OpenAI API key test failed:', error);

      // Determine the specific error type for better error messages
      let errorMessage = 'Unknown error validating OpenAI API key';

      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Your OpenAI API key has reached its request limit or has insufficient quota.';
      } else if (error.status === 500) {
        errorMessage = 'OpenAI server error. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    // Ensure opacity is between 0.1 and 1.0
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
  }

  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();