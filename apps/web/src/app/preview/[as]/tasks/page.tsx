import { TaskList } from "@/components/tasks/task-list";
import { previewTasks } from "@/lib/preview";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("nav"))("tasks") };
}

export default async function PreviewTasks(props: PageProps<"/preview/[as]/tasks">) {
  const { as } = await props.params;
  const { data, tasks, customers } = previewTasks(as);
  return <TaskList tasks={tasks} people={data.people} customers={customers} viewer={data.viewer} now={data.now} base={`/preview/${as}`} />;
}
