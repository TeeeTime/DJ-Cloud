import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface ConfigScreenProps {
  targetFolder: string | null;
  onSave: (folder: string) => void;
}

const PLACEHOLDER_FOLDER = "C:\\Users\\you\\Music\\DJ Cloud";

export function ConfigScreen({ targetFolder, onSave }: ConfigScreenProps) {
  const [folder, setFolder] = useState(targetFolder ?? "");

  return (
    <div className="flex h-full flex-col justify-center bg-background px-6">
      <Card>
        <CardHeader>
          <CardTitle>Library folder</CardTitle>
          <CardDescription>
            Choose where synced tracks are stored on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-2">
          <Input readOnly value={folder} placeholder="No folder selected" />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setFolder(PLACEHOLDER_FOLDER)}
          >
            Browse…
          </Button>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            disabled={!folder}
            onClick={() => onSave(folder)}
          >
            Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
