import {types, getEnv, applySnapshot, getSnapshot} from 'mobx-state-tree';
import {PageStore} from './Page';
import {when, reaction} from 'mobx';

export const MainStore = types
  .model('MainStore', {
    pages: types.optional(types.array(PageStore), [
      {
        path: 'hello-world',
        label: 'Hello world',
        icon: 'fas fa-file',
        schema: {
          type: 'page',
          title: 'Hello world',
          body: '初始页面'
        }
      }
    ]),
    theme: 'cxd',
    asideFixed: true,
    asideFolded: false,
    offScreen: false,
    addPageIsOpen: false,
    preview: false,
    isMobile: false,
    schema: types.frozen()
  })
  .views(self => ({
    get fetcher() {
      return getEnv(self).fetcher;
    },
    get notify() {
      return getEnv(self).notify;
    },
    get alert() {
      return getEnv(self).alert;
    },
    get copy() {
      return getEnv(self).copy;
    }
  }))
  .actions(self => {
    function toggleAsideFolded() {
      self.asideFolded = !self.asideFolded;
    }

    function toggleAsideFixed() {
      self.asideFixed = !self.asideFixed;
    }

    function toggleOffScreen() {
      self.offScreen = !self.offScreen;
    }

    function setAddPageIsOpen(isOpened: boolean) {
      self.addPageIsOpen = isOpened;
    }

    function addPage(data: {
      label: string;
      path: string;
      icon?: string;
      schema?: any;
      isDirectory?: boolean;
      parentId?: string;
    }) {
      self.pages.push(
        PageStore.create({
          ...data
        })
      );
    }

    function removePageAt(index: number) {
      self.pages.splice(index, 1);
    }

    function removePageById(path: string) {
      // 递归获取所有子项目的 path
      function getAllChildrenPaths(parentPath: string): string[] {
        let paths: string[] = [];
        self.pages.forEach((page: any) => {
          if (page.parentId === parentPath) {
            paths.push(page.path);
            // 递归获取子项目的子项目
            paths = paths.concat(getAllChildrenPaths(page.path));
          }
        });
        return paths;
      }

      // 获取当前项目和所有子项目的 path
      const pathsToRemove = [path, ...getAllChildrenPaths(path)];

      // 从后向前删除，避免索引变化
      for (let i = self.pages.length - 1; i >= 0; i--) {
        if (pathsToRemove.includes(self.pages[i].path)) {
          self.pages.splice(i, 1);
        }
      }
    }

    function updatePageSchemaAt(index: number) {
      self.pages[index].updateSchema(self.schema);
    }

    function updateSchema(value: any) {
      self.schema = value;
    }

    function setPreview(value: boolean) {
      self.preview = value;
    }

    function setIsMobile(value: boolean) {
      self.isMobile = value;
    }

    return {
      toggleAsideFolded,
      toggleAsideFixed,
      toggleOffScreen,
      setAddPageIsOpen,
      addPage,
      removePageAt,
      removePageById,
      updatePageSchemaAt,
      updateSchema,
      setPreview,
      setIsMobile,
      afterCreate() {
        // persist store
        if (typeof window !== 'undefined' && window.localStorage) {
          const storeData = window.localStorage.getItem('store');
          if (storeData) applySnapshot(self, JSON.parse(storeData));

          reaction(
            () => getSnapshot(self),
            json => {
              window.localStorage.setItem('store', JSON.stringify(json));
            }
          );
        }
      }
    };
  });

export type IMainStore = typeof MainStore.Type;
