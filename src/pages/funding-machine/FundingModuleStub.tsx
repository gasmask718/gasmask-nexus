import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wrench } from "lucide-react";

interface Props {
  title: string;
  description: string;
}

export default function FundingModuleStub({ title, description }: Props) {
  const navigate = useNavigate();
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/funding-machine")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-[#C9A84C]" />
            Module Registered
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This Funding Machine module is registered and reachable. Full UI is
          scheduled to land in the next release wave.
        </CardContent>
      </Card>
    </div>
  );
}
