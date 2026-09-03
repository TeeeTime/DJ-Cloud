import { useState } from "react";
import { LoginScreen } from "./screens/LoginScreen";
import { ConfigScreen } from "./screens/ConfigScreen";
import { MainScreen } from "./screens/MainScreen";

type Screen = "login" | "config" | "main";

function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [targetFolder, setTargetFolder] = useState<string | null>(null);

  if (screen === "login") {
    return <LoginScreen onLogin={() => setScreen("config")} />;
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
        setTargetFolder(null);
        setScreen("login");
      }}
    />
  );
}

export default App;
