import { useEffect, useState } from "react";
import { LoginScreen } from "./screens/LoginScreen";
import { ConfigScreen } from "./screens/ConfigScreen";
import { MainScreen } from "./screens/MainScreen";
import { commands, onAuthTokenReceived } from "./lib/commands";

type Screen = "loading" | "login" | "config" | "main";

function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [targetFolder, setTargetFolder] = useState<string | null>(null);

  // Moves to Config (if no library folder is set yet) or straight to Main — shared by the
  // startup bootstrap and by a fresh login arriving via the "auth-token-received" event.
  async function enterAppAfterAuth() {
    const settings = await commands.getSettings();
    setTargetFolder(settings.libraryFolder);
    setScreen(settings.libraryFolder ? "main" : "config");
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const auth = await commands.getAuthToken();
      const isValid = auth ? await commands.validateAuthToken() : false;
      if (cancelled) return;

      if (!isValid) {
        setScreen("login");
        return;
      }

      await enterAppAfterAuth();
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = onAuthTokenReceived(() => {
      enterAppAfterAuth();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  if (screen === "loading") {
    return <div className="h-full bg-background" />;
  }

  if (screen === "login") {
    return <LoginScreen />;
  }

  if (screen === "config") {
    return (
      <ConfigScreen
        targetFolder={targetFolder}
        onSave={(folder) => {
          setTargetFolder(folder);
          setScreen("main");
        }}
      />
    );
  }

  return (
    <MainScreen
      targetFolder={targetFolder}
      onChangeFolder={() => setScreen("config")}
      onLogout={() => {
        commands.clearAuthToken();
        setTargetFolder(null);
        setScreen("login");
      }}
    />
  );
}

export default App;
