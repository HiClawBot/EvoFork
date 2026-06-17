export const moduleId = "@evofork/openfeature-provider";

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
