import { ToolModule } from '../module';
import { relationshipRead } from './read';
import { registerWriteTools } from './write';
import { registerPlanWriteTools } from './plans';

export { relationshipRead };

/**
 * The write tools declare `relationship:read` as well, because both resolve an
 * activity type by name before writing: a write-only key would see them and
 * fail on the first call.
 */
export const relationshipWrite: ToolModule = {
  scopes: ['relationship:read', 'relationship:write'],
  register: (server, caller) => {
    registerWriteTools(server, caller);
    registerPlanWriteTools(server, caller);
  }
};
