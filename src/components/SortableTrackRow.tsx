import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TrackRow } from './TrackRow';
import type { Track } from '@/types';

interface Props {
  track: Track;
  index: number;
  contextIds: string[];
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export function SortableTrackRow({ track, index, contextIds, isSelected, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-pan-y">
      <TrackRow 
        track={track} 
        index={index} 
        contextIds={contextIds} 
        showAlbum 
        isSelected={isSelected} 
        onSelect={onSelect} 
      />
    </div>
  );
}