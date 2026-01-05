// ConfigHelper.ts
import { EventEmitter } from "events"
import * as dotenv from "dotenv"
import { OpenAI } from "openai"
import path from "node:path"
import fs from "node:fs"

interface Config {
  aiApiKey: string;
  aiEndpoint: string;
  aiModel: string;
  language: string;
  opacity: number;
}

export class ConfigHelper extends EventEmitter {
  private defaultConfig: Config = {
    aiApiKey: "",
    aiEndpoint: "https://api.openai.com/v1",
    aiModel: "gpt-4o",
    language: "python",
    opacity: 1.0
  };

  constructor() {
    super();
    this.loadEnvFile();
  }

  /**
   * Load .env file from electron directory
   */
  private loadEnvFile(): void {
    try {
      const envPath = path.join(process.cwd(), 'electron', '.env');
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
      }
    } catch (error) {
      console.warn('Could not load .env file:', error);
    }
  }

  /**
   * Load configuration from environment variables
   */
  public loadConfig(): Config {
    try {
      const config: Config = {
        aiApiKey: process.env.AI_API_KEY || this.defaultConfig.aiApiKey,
        aiEndpoint: process.env.AI_ENDPOINT || this.defaultConfig.aiEndpoint,
        aiModel: process.env.AI_MODEL || this.defaultConfig.aiModel,
        language: process.env.DEFAULT_LANGUAGE || this.defaultConfig.language,
        opacity: this.defaultConfig.opacity
      };

      return config;
    } catch (err) {
      console.error("Error loading config:", err);
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
   * Check if API key is from environment variables
   */
  public hasEnvApiKey(): boolean {
    return !!(process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 0);
  }

  /**
   * Validate API key format (basic validation)
   */
  public isValidApiKeyFormat(apiKey: string): boolean {
    return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
  }

  /**
   * Test API key with OpenAI
   */
  public async testApiKey(apiKey: string): Promise<{ valid: boolean, error?: string }> {
    try {
      const openai = new OpenAI({ apiKey });
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('OpenAI API key test failed:', error);

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
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();