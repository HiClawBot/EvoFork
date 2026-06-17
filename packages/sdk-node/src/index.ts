export const moduleId = "@evofork/sdk-node";

export type ModuleStatus = {
  name: string;
  status: "placeholder";
};

export function getModuleStatus(): ModuleStatus {
  return {
    name: moduleId,
    status: "placeholder"
  };
}
