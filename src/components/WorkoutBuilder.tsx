import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { workoutTemplates, mockAthletes, sportsList } from "@/data/mockData";
import { Plus, Trash2, Send, Dumbbell, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WorkoutBuilderProps {
  open: boolean;
  onClose: () => void;
}

interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  weightUnit: "lbs" | "kg";
  targetVelocityMin: number;
  targetVelocityMax: number;
}

export const WorkoutBuilder = ({ open, onClose }: WorkoutBuilderProps) => {
  const [workoutName, setWorkoutName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [filterSport, setFilterSport] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");

  const exerciseLibrary = [
    "Back Squat", "Front Squat", "Romanian Deadlift", "Bench Press",
    "Overhead Press", "Power Clean", "Hang Clean", "Box Jump",
    "Trap Bar Deadlift", "Bulgarian Split Squat", "Single Leg RDL",
    "Incline Bench Press", "Push Press", "Pull-ups", "Barbell Row"
  ];

  const handleTemplateSelect = (templateId: string) => {
    const template = workoutTemplates.find(t => t.id === templateId);
    if (template) {
      setWorkoutName(template.name);
      setExercises(template.exercises.map(ex => ({
        ...ex,
        targetVelocityMin: ex.targetVelocityMin,
        targetVelocityMax: ex.targetVelocityMax,
      })));
      setSelectedTemplate(templateId);
    }
  };

  const addExercise = () => {
    setExercises([...exercises, {
      name: "Back Squat",
      sets: 3,
      reps: 5,
      weight: 135,
      weightUnit: "lbs",
      targetVelocityMin: 1.0,
      targetVelocityMax: 1.5,
    }]);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, field: keyof WorkoutExercise, value: any) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  };

  const toggleAthlete = (athleteId: string) => {
    setSelectedAthletes(prev =>
      prev.includes(athleteId)
        ? prev.filter(id => id !== athleteId)
        : [...prev, athleteId]
    );
  };

  const selectAllFiltered = () => {
    const filtered = filteredAthletes.map(a => a.id);
    setSelectedAthletes(filtered);
  };

  const filteredAthletes = mockAthletes.filter(athlete => {
    if (filterSport !== "all" && athlete.sport !== filterSport) return false;
    if (filterLevel !== "all" && athlete.level !== filterLevel) return false;
    if (filterGroup !== "all" && athlete.group !== filterGroup) return false;
    return true;
  });

  const handleSendWorkout = () => {
    if (!workoutName || exercises.length === 0 || selectedAthletes.length === 0) {
      toast.error("Please fill out workout name, add exercises, and select athletes");
      return;
    }

    const dateInfo = scheduledDate ? ` for ${format(scheduledDate, "PPP")}` : "";
    toast.success(`Workout "${workoutName}" sent to ${selectedAthletes.length} athlete(s)${dateInfo}`);
    onClose();
    // Reset form
    setWorkoutName("");
    setExercises([]);
    setSelectedAthletes([]);
    setSelectedTemplate("");
    setScheduledDate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            Send Workout
          </DialogTitle>
          <DialogDescription>
            Create a workout and assign it to athletes or groups
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Left Column - Workout Builder */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workoutName">Workout Name</Label>
              <Input
                id="workoutName"
                placeholder="e.g., Lower Body Power"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Load from Template</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {workoutTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Exercises</Label>
                <Button size="sm" onClick={addExercise}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Exercise
                </Button>
              </div>

              {exercises.map((exercise, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Select
                        value={exercise.name}
                        onValueChange={(value) => updateExercise(index, "name", value)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {exerciseLibrary.map(ex => (
                            <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeExercise(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Sets</Label>
                        <Input
                          type="number"
                          value={exercise.sets}
                          onChange={(e) => updateExercise(index, "sets", parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Reps</Label>
                        <Input
                          type="number"
                          value={exercise.reps}
                          onChange={(e) => updateExercise(index, "reps", parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Weight</Label>
                        <Input
                          type="number"
                          value={exercise.weight}
                          onChange={(e) => updateExercise(index, "weight", parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <Select
                          value={exercise.weightUnit}
                          onValueChange={(value: "lbs" | "kg") => updateExercise(index, "weightUnit", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lbs">lbs</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Target Velocity Range (m/s)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Min"
                          value={exercise.targetVelocityMin}
                          onChange={(e) => updateExercise(index, "targetVelocityMin", parseFloat(e.target.value))}
                        />
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Max"
                          value={exercise.targetVelocityMax}
                          onChange={(e) => updateExercise(index, "targetVelocityMax", parseFloat(e.target.value))}
                        />
                      </div>
                    </div>

                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Right Column - Athlete Selection */}
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Filter Athletes</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={filterSport} onValueChange={setFilterSport}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sports</SelectItem>
                    {sportsList.map((sport) => (
                      <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="Varsity">Varsity</SelectItem>
                    <SelectItem value="JV">JV</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterGroup} onValueChange={setFilterGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    <SelectItem value="Offense">Offense</SelectItem>
                    <SelectItem value="Defense">Defense</SelectItem>
                    <SelectItem value="Guards">Guards</SelectItem>
                    <SelectItem value="Forwards">Forwards</SelectItem>
                    <SelectItem value="Midfield">Midfield</SelectItem>
                    <SelectItem value="Setters">Setters</SelectItem>
                    <SelectItem value="Hitters">Hitters</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={selectAllFiltered}
                >
                  Select All ({filteredAthletes.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedAthletes([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">
                Selected Athletes ({selectedAthletes.length})
              </Label>
              <Card className="max-h-[500px] overflow-y-auto">
                <CardContent className="p-3 space-y-2">
                  {filteredAthletes.map(athlete => (
                    <div
                      key={athlete.id}
                      className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                      onClick={() => toggleAthlete(athlete.id)}
                    >
                      <Checkbox
                        checked={selectedAthletes.includes(athlete.id)}
                        onCheckedChange={() => toggleAthlete(athlete.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{athlete.name}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">{athlete.sport}</Badge>
                          <Badge variant="outline" className="text-xs">{athlete.level}</Badge>
                          <Badge variant="outline" className="text-xs">{athlete.group}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSendWorkout} className="bg-primary text-navy-dark hover:bg-primary/90">
            <Send className="h-4 w-4 mr-2" />
            Send Workout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
