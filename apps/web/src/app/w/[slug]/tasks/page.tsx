import { TaskList } from "@/components/tasks/task-list";
import { loadBoardTasks, loadCustomerChoices } from "@/lib/crm-live";
import { requestNow } from "@/lib/now";
import { loadPeople } from "@/lib/viewer";
import { loadWorkspace } from "@/lib/workspace";
import { getT } from "@/i18n/server";
import { completeTask, createTask, noteTask, snoozeTask, undoCompleteTask } from "./actions";

export async function generateMetadata() {
  return { title: (await getT("nav"))("tasks") };
}

/* Tasks on real data (decided 2026-11-03). Row-level security decides which tasks this person sees. */
export default async function TasksPage(props: PageProps<"/w/[slug]/tasks">) {
  const { slug } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const [{ people, viewer }, tasks, customers] = await Promise.all([
    loadPeople(supabase, workspace.id, me.id),
    loadBoardTasks(supabase, workspace.id),
    loadCustomerChoices(supabase, workspace.id),
  ]);

  return (
    <TaskList
      tasks={tasks}
      people={people.map(({ id, name, role, canReply }) => ({ id, name, role, canReply }))}
      customers={customers}
      viewer={viewer}
      now={requestNow()}
      base={`/w/${slug}`}
      live={{
        create: createTask.bind(null, slug),
        complete: completeTask.bind(null, slug),
        undo: undoCompleteTask.bind(null, slug),
        snooze: snoozeTask.bind(null, slug),
        note: noteTask.bind(null, slug),
      }}
    />
  );
}
