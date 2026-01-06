import {types, getEnv, Instance} from 'mobx-state-tree';

const PageStoreModel = types
  .model('Page', {
    path: types.identifier,  // 使用 path 作为唯一标识
    icon: '',
    label: '',
    schema: types.frozen({}),
    parentId: types.maybe(types.string),
    isDirectory: types.optional(types.boolean, false) // 是否为目录
  })
  .views(self => ({}))
  .actions(self => {
    function updateSchema(schema: any) {
      self.schema = schema;
    }

    return {
      updateSchema
    };
  });

export const PageStore: any = types.compose(
  PageStoreModel,
  types.model({
    children: types.optional(types.array(types.late((): any => PageStore)), [])
  })
);

export type IPageStore = Instance<typeof PageStore>;
