import { TaskList } from "@/components/tasks/task-list";
import { previewTasks } from "@/lib/preview";

export const metadata = { title: "Tasks" };

export default async function PreviewTasks(props: PageProps<"/preview/[as]/tasks">) {
  const { as } = await props.params;
  const { data, tasks, customers } = previewTasks(as);
  return <TaskList tasks={tasks} people={data.people} customers={customers} viewer={data.viewer} now={data.now} base={`/preview/${as}`} />;
}
