import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Trash2, GripVertical } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getColorFromString, getIconForTopic } from "@/utils/colorUtils";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableLearningPathProps {
  path: {
    id: string;
    subject: string;
    structure: any;
  };
  progress: number;
  onDelete: (id: string) => void;
  onClick: () => void;
}

export const SortableLearningPath = ({ path, progress, onDelete, onClick }: SortableLearningPathProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: path.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isComplete = progress === 100;
  const gradient = getColorFromString(path.subject);
  const icon = getIconForTopic(path.subject);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="p-4 rounded-2xl border-0 shadow-lg cursor-pointer transition-all hover:shadow-xl active:scale-[0.98]"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
          style={{ background: gradient }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">
              {path.subject}
              {isComplete && <CheckCircle2 className="w-4 h-4 text-green-500 inline ml-1" />}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(path.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {path.structure?.topics?.length || 0} emner
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}% fuldført</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>
      </div>
    </Card>
  );
};
