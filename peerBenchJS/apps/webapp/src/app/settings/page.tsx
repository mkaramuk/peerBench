"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import Image from "next/image";
import "react-toastify/dist/ReactToastify.css";

export const fetchCache = "force-no-store";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [nearAiToken, setNearAiToken] = useState("");
  const [nearAiConfigFile, setNearAiConfigFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load saved API key from localStorage
    const savedApiKey = localStorage.getItem("openrouter_api_key");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    // Load saved Near AI token from localStorage
    const savedNearAiToken = localStorage.getItem("nearai_auth_token");
    if (savedNearAiToken) {
      setNearAiToken(savedNearAiToken);
    }
  }, []);

  const handleNearAiConfigUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNearAiConfigFile(file);
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      if (obj && obj.auth) {
        const authString = JSON.stringify(obj.auth);
        setNearAiToken(authString);
        toast.success("Near AI auth token loaded from config file");
      } else {
        toast.error("Invalid config file: missing 'auth' property");
        setNearAiConfigFile(null);
      }
    } catch {
      setNearAiConfigFile(null);
      toast.error("Failed to parse the given Near AI config file");
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save API key to localStorage
      localStorage.setItem("openrouter_api_key", apiKey);

      // Save Near AI token to localStorage
      localStorage.setItem("nearai_auth_token", nearAiToken);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium mb-2"
              >
                <span className="flex items-center gap-2">
                  <Image
                    src="/openrouter.svg"
                    alt="OpenRouter"
                    width={24}
                    height={24}
                  />
                  OpenRouter API Key
                </span>
              </label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setApiKey(e.target.value)
                }
                placeholder="Enter your OpenRouter API key"
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Your API key will be stored in your browser&apos;s localStorage.
              </p>
            </div>
            <div>
              <label
                htmlFor="nearAiToken"
                className="block text-sm font-medium mb-2"
              >
                <span className="flex items-center gap-2">
                  <Image
                    src="/nearai.png"
                    alt="Near AI"
                    width={24}
                    height={24}
                  />
                  Near AI Auth
                </span>
              </label>

              <div className="items-center flex gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    document.getElementById("nearai-config-upload")?.click()
                  }
                  className="border-gray-300"
                  size="default"
                  title="Upload Near AI config JSON"
                >
                  Upload Near AI config JSON
                  <input
                    id="nearai-config-upload"
                    type="file"
                    accept="application/json"
                    onChange={handleNearAiConfigUpload}
                    className="hidden"
                    title="Select config.json from ~/.nearai directory"
                  />
                </Button>
                <div className="text-sm text-muted-foreground">
                  {nearAiToken || nearAiConfigFile
                    ? nearAiConfigFile?.name || "Set"
                    : "Not set"}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Your config file is available under ~/.nearai/config.json after
                you&apos;ve run &quot;nearai login&quot; command
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              variant="default"
              size="default"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
