import { TreeNode } from 'primeng/api';

export class DataUtils {
    static sortTree(tree: any[], childrenPropName: string, compareFunc: (a: any, b: any) => number) {
        tree.sort(compareFunc);

        for (let i: number = 0; i < tree.length; i++) {
            let element: any = tree[i];

            if (element[childrenPropName] && element[childrenPropName].length > 0) {
                DataUtils.sortTree(element[childrenPropName], childrenPropName, compareFunc);
            }
        }
    }

    static findInTree(tree: any[], childrenPropName: string, condition: Function) {
        for (let i: number = 0; i < tree.length; i++) {
            let element: any = tree[i];

            if (condition(element)) {
                return element;
            } else {
                if (element[childrenPropName] && element[childrenPropName].length > 0) {
                    let node: any = DataUtils.findInTree(element[childrenPropName], childrenPropName, condition);

                    if (node) {
                        return node;
                    }
                }
            }
        }

        return null;
    }

    static findAllInTree(tree: any[], childrenPropName: string, condition: Function) {
        let arr: any[] = [];

        for (let i: number = 0; i < tree.length; i++) {
            let element: any = tree[i];

            if (condition(element)) {
                arr.push(element);
            } else {
                if (element[childrenPropName] && element[childrenPropName].length > 0) {
                    let nodes: any[] = DataUtils.findAllInTree(element[childrenPropName], childrenPropName, condition);

                    if (nodes) {
                        arr = arr.concat(nodes);
                    }
                }
            }
        }

        return arr;
    }

    static addParentPropToTree(tree: any[], childrenPropName: string, parent: any = null) {
        for (let i: number = 0; i < tree.length; i++) {
            let element: any = tree[i];
            element.parent = parent;

            let childTree: any = element[childrenPropName];
            if (childTree) {
                DataUtils.addParentPropToTree(childTree, childrenPropName, element);
            }
        }
    }

    static getNodeAncestors(node: TreeNode) {
        let items: TreeNode[] = [];

        while (node) {
            items.unshift(node);
            node = node.parent;
        }

        return items;
    }
}
