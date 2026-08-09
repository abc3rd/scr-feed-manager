import React from 'react';
import { Megaphone } from 'lucide-react';

export default function AnnouncementBanner({ announcement }) {
  return (
    <div className="rounded-lg border bg-primary/5 p-3 flex gap-2 items-start">
      <Megaphone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
      <div>
        <p className="font-medium text-sm">{announcement.title}</p>
        <p className="text-xs text-muted-foreground">{announcement.message}</p>
      </div>
    </div>
  );
}