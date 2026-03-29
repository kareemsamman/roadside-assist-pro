import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles } from "lucide-react";
import { useWorkflow } from "@/context/WorkflowContext";
import { generateParking } from "@/lib/api-client";
import type { ParkingRules } from "@/types/cad";
import { DEFAULT_PARKING_RULES } from "@/types/cad";

const PRESETS: { label: string; width: number; length: number }[] = [
  { label: "2.0 × 6.0 m", width: 2.0, length: 6.0 },
  { label: "2.5 × 7.5 m", width: 2.5, length: 7.5 },
  { label: "3.0 × 8.0 m", width: 3.0, length: 8.0 },
];

export function ConfigureStep() {
  const { state, dispatch, goToStep } = useWorkflow();
  const [rules, setRules] = useState<ParkingRules>(state.parkingRules);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const update = (partial: Partial<ParkingRules>) => {
    setRules((r) => ({ ...r, ...partial }));
  };

  const handleAiParse = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    // Simulate AI parsing (would call edge function)
    await new Promise((r) => setTimeout(r, 1000));

    // Simple rule extraction from text
    const text = aiPrompt.toLowerCase();
    const widthMatch = text.match(/(\d+\.?\d*)\s*(?:by|x|×)\s*(\d+\.?\d*)/);
    const spacingMatch = text.match(/every\s+(\d+\.?\d*)/);
    const sideMatch = text.match(/\b(left|right)\b/);

    if (widthMatch) {
      update({ bayWidth: parseFloat(widthMatch[1]), bayLength: parseFloat(widthMatch[2]) });
    }
    if (spacingMatch) update({ spacing: parseFloat(spacingMatch[1]) });
    if (sideMatch) update({ side: sideMatch[1] as "left" | "right" });

    setAiLoading(false);
  };

  const handleGenerate = async () => {
    if (!state.uploadData || !state.selectedEdgeId) return;
    setGenerating(true);
    dispatch({ type: "SET_PARKING_RULES", rules });
    dispatch({ type: "SET_LOADING", loading: true });

    try {
      const result = await generateParking(state.uploadData.fileId, state.selectedEdgeId, rules);
      dispatch({ type: "SET_GENERATED_BAYS", bays: result.bays });
      dispatch({ type: "SET_LOADING", loading: false });
      goToStep("preview");
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Generation failed" });
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Parking Bay Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Define dimensions, spacing, and placement rules for accessible parking bays.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rules Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimension Presets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant={rules.bayWidth === p.width && rules.bayLength === p.length ? "default" : "outline"}
                    size="sm"
                    onClick={() => update({ bayWidth: p.width, bayLength: p.length })}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bay Dimensions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bayWidth">Width (m)</Label>
                <Input id="bayWidth" type="number" step="0.1" value={rules.bayWidth} onChange={(e) => update({ bayWidth: parseFloat(e.target.value) || 0 })} className="font-mono" />
              </div>
              <div>
                <Label htmlFor="bayLength">Length (m)</Label>
                <Input id="bayLength" type="number" step="0.1" value={rules.bayLength} onChange={(e) => update({ bayLength: parseFloat(e.target.value) || 0 })} className="font-mono" />
              </div>
              <div>
                <Label htmlFor="spacing">Spacing (m)</Label>
                <Input id="spacing" type="number" step="1" value={rules.spacing} onChange={(e) => update({ spacing: parseFloat(e.target.value) || 0 })} className="font-mono" />
              </div>
              <div>
                <Label htmlFor="offset">Lateral Offset (m)</Label>
                <Input id="offset" type="number" step="0.1" value={rules.lateralOffset} onChange={(e) => update({ lateralOffset: parseFloat(e.target.value) || 0 })} className="font-mono" />
              </div>
              <div>
                <Label htmlFor="clearance">Min Clearance (m)</Label>
                <Input id="clearance" type="number" step="0.1" value={rules.minClearance} onChange={(e) => update({ minClearance: parseFloat(e.target.value) || 0 })} className="font-mono" />
              </div>
              <div>
                <Label htmlFor="orientation">Orientation</Label>
                <select
                  id="orientation"
                  value={rules.orientation}
                  onChange={(e) => update({ orientation: e.target.value as ParkingRules["orientation"] })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                >
                  <option value="parallel">Parallel</option>
                  <option value="perpendicular">Perpendicular</option>
                  <option value="angled">Angled</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Numbering</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="prefix">Prefix</Label>
                <Input id="prefix" value={rules.numberPrefix} onChange={(e) => update({ numberPrefix: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label htmlFor="startNum">Starting Number</Label>
                <Input id="startNum" type="number" value={rules.startingNumber} onChange={(e) => update({ startingNumber: parseInt(e.target.value) || 1 })} className="font-mono" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Block Insertion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="insertPole">Insert pole block</Label>
                <Switch id="insertPole" checked={rules.insertPole} onCheckedChange={(c) => update({ insertPole: c })} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="insertSign">Insert sign block</Label>
                <Switch id="insertSign" checked={rules.insertSign} onCheckedChange={(c) => update({ insertSign: c })} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Input + Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Rule Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder='e.g. "Create disabled parking bays 2.5 by 7.5 meters every 20 meters on the right side"'
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
              />
              <Button onClick={handleAiParse} disabled={aiLoading || !aiPrompt.trim()} className="w-full">
                {aiLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Parsing…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Parse Rules</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                AI interprets your instruction and fills the form. All parameters remain editable.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Bay Size</dt>
                  <dd className="font-mono">{rules.bayWidth} × {rules.bayLength} m</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Spacing</dt>
                  <dd className="font-mono">{rules.spacing} m</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Lateral Offset</dt>
                  <dd className="font-mono">{rules.lateralOffset} m</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Min Clearance</dt>
                  <dd className="font-mono">{rules.minClearance} m</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Orientation</dt>
                  <dd className="font-mono capitalize">{rules.orientation}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Side</dt>
                  <dd className="font-mono capitalize">{rules.side}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Numbering</dt>
                  <dd className="font-mono">{rules.numberPrefix}{rules.startingNumber}, {rules.numberPrefix}{rules.startingNumber + 1}, …</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Blocks</dt>
                  <dd className="flex gap-1">
                    {rules.insertPole && <Badge variant="secondary" className="text-xs">Pole</Badge>}
                    {rules.insertSign && <Badge variant="secondary" className="text-xs">Sign</Badge>}
                    {!rules.insertPole && !rules.insertSign && <span className="text-muted-foreground">None</span>}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => goToStep("analyze")}>Back</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</>
              ) : (
                "Generate Parking Bays"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
