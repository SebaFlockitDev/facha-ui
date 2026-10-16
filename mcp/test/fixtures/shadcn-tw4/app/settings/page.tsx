import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  return (
    <main className="bg-background text-foreground">
      <h1>Ajustes</h1>
      <Card>
        <form>
          <input type="hidden" name="token" value="x" />
          <label htmlFor="name">Nombre</label>
          <Input id="name" />
          <div className="flex gap-2">
            <Button>Guardar cambios</Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
