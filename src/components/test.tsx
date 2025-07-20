"use client";

import TreeView, {
  type TreeViewItem,
  getCheckState,
} from "@/components/tree-view"; // Import getCheckState
import { useCallback, useEffect, useMemo, useState } from "react";

// Helper function to build a map of all items by ID
const buildItemMap = (items: TreeViewItem[]): Map<string, TreeViewItem> => {
  const map = new Map<string, TreeViewItem>();
  const processItem = (item: TreeViewItem) => {
    map.set(item.id, item);
    item.children?.forEach(processItem);
  };
  items.forEach(processItem);
  return map;
};

// Helper function to deep clone data
const deepCloneData = (data: TreeViewItem[]): TreeViewItem[] => {
  return data.map((item) => ({
    ...item,
    children: item.children ? deepCloneData(item.children) : undefined,
  }));
};

// Helper to update checked state recursively for children
const updateChildrenCheckedState = (
  items: TreeViewItem[],
  checked: boolean
) => {
  items.forEach((child) => {
    child.checked = checked;
    if (child.children) {
      updateChildrenCheckedState(child.children, checked);
    }
  });
};

// Simulate an API call to fetch children
const fetchChildren = async (parentId: string): Promise<TreeViewItem[]> => {
  console.log(`Fetching children for ${parentId}...`);
  return new Promise((resolve) => {
    setTimeout(() => {
      let children: TreeViewItem[] = [];
      if (parentId === "1.1") {
        children = [
          { id: "1.1.1", name: "users", type: "table", checked: false },
          { id: "1.1.2", name: "products", type: "table" },
          { id: "1.1.3", name: "orders", type: "table" },
          { id: "1.1.4", name: "get_user_by_id", type: "function" },
        ];
      } else if (parentId === "1.2") {
        children = [
          { id: "1.2.1", name: "daily_sales", type: "view" },
          { id: "1.2.2", name: "customer_segments", type: "table" },
        ];
      } else if (parentId === "2.1") {
        children = [
          { id: "2.1.1", name: "employees", type: "table" },
          { id: "2.1.2", name: "departments", type: "table" },
        ];
      } else if (parentId === "1") {
        children = [
          {
            id: "1.1",
            name: "Schema Public",
            type: "folder",
            children: [],
            loaded: false,
          },
          {
            id: "1.2",
            name: "Schema Analytics",
            type: "folder",
            children: [],
            loaded: false,
          },
          { id: "1.3", name: "Database Config", type: "file" },
        ];
      } else if (parentId === "2") {
        children = [
          {
            id: "2.1",
            name: "Schema HR",
            type: "folder",
            children: [],
            loaded: false,
          },
        ];
      }
      resolve(children);
    }, 700); // Simulate network delay
  });
};

// Initial data with some folders marked for lazy loading
const initialData: TreeViewItem[] = [
  {
    id: "1",
    name: "Database A",
    type: "folder",
    children: [], // Children will be loaded asynchronously
    loaded: false,
  },
  {
    id: "2",
    name: "Database B",
    type: "folder",
    children: [], // Children will be loaded asynchronously
    loaded: false,
  },
  { id: "3", name: "External Data Source", type: "file" },
];

export default function TreeViewDemo() {
  const [internalData, setInternalData] = useState<TreeViewItem[]>(() =>
    deepCloneData(initialData)
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Create a map of all items by ID from internalData
  const itemMap = useMemo(() => buildItemMap(internalData), [internalData]);

  // Get all checked items
  const getCheckedItems = useCallback(
    (dataToProcess: TreeViewItem[] = internalData): TreeViewItem[] => {
      const items: TreeViewItem[] = [];
      const processItem = (item: TreeViewItem) => {
        if (item.checked) {
          items.push(item);
        }
        item.children?.forEach(processItem);
      };
      dataToProcess.forEach(processItem);
      return items;
    },
    [internalData]
  );

  const handleToggleExpand = useCallback(
    (id: string, isOpen: boolean, item: TreeViewItem) => {
      setExpandedIds((prev) => {
        const newExpandedIds = new Set(prev);
        if (isOpen) {
          newExpandedIds.add(id);
        } else {
          newExpandedIds.delete(id);
        }
        return newExpandedIds;
      });

      // If expanding a folder that hasn't loaded its children yet
      if (
        isOpen &&
        item.children &&
        item.children.length === 0 &&
        !item.loaded &&
        !item.loading
      ) {
        setInternalData((prevData) => {
          const newData = deepCloneData(prevData);
          const targetItem = newData.find((node) => node.id === item.id); // Find top-level item
          if (targetItem) {
            // For nested items, you'd need a recursive find-and-update
            const findAndSetLoading = (
              nodes: TreeViewItem[],
              targetId: string
            ): boolean => {
              for (const node of nodes) {
                if (node.id === targetId) {
                  node.loading = true;
                  return true;
                }
                if (
                  node.children &&
                  findAndSetLoading(node.children, targetId)
                ) {
                  return true;
                }
              }
              return false;
            };
            findAndSetLoading(newData, item.id);
          }
          return newData;
        });

        fetchChildren(item.id)
          .then((children) => {
            setInternalData((prevData) => {
              const newData = deepCloneData(prevData);
              const updateItemChildren = (
                nodes: TreeViewItem[],
                targetId: string
              ): boolean => {
                for (const node of nodes) {
                  if (node.id === targetId) {
                    node.children = children;
                    node.loaded = true;
                    node.loading = false;
                    return true;
                  }
                  if (
                    node.children &&
                    updateItemChildren(node.children, targetId)
                  ) {
                    return true;
                  }
                }
                return false;
              };
              updateItemChildren(newData, item.id);
              return newData;
            });
          })
          .catch((error) => {
            console.error("Failed to load children:", error);
            setInternalData((prevData) => {
              const newData = deepCloneData(prevData);
              const findAndSetLoadingFalse = (
                nodes: TreeViewItem[],
                targetId: string
              ): boolean => {
                for (const node of nodes) {
                  if (node.id === targetId) {
                    node.loading = false;
                    return true;
                  }
                  if (
                    node.children &&
                    findAndSetLoadingFalse(node.children, targetId)
                  ) {
                    return true;
                  }
                }
                return false;
              };
              findAndSetLoadingFalse(newData, item.id);
              return newData;
            });
          });
      }
    },
    [] // No dependencies, setExpandedIds and setInternalData are stable
  );

  const handleCheckChange = useCallback(
    (item: TreeViewItem, checked: boolean) => {
      setInternalData((prevData) => {
        const newData = deepCloneData(prevData); // Create a deep copy
        const newItemMap = buildItemMap(newData); // Rebuild map for new data

        // Find the item in the new data structure and update its checked state
        const updateItemInTree = (
          items: TreeViewItem[],
          id: string,
          newChecked: boolean
        ): boolean => {
          for (const currentItem of items) {
            if (currentItem.id === id) {
              currentItem.checked = newChecked;
              if (currentItem.children) {
                updateChildrenCheckedState(currentItem.children, newChecked);
              }
              return true;
            }
            if (
              currentItem.children &&
              updateItemInTree(currentItem.children, id, newChecked)
            ) {
              return true;
            }
          }
          return false;
        };

        updateItemInTree(newData, item.id, checked);

        // After updating the item and its children, update ancestors
        let current = newItemMap.get(item.id);
        while (current) {
          const parent = Array.from(newItemMap.values()).find(
            (node) =>
              node.children &&
              node.children.some((child) => child.id === current?.id)
          );
          if (parent) {
            const parentState = getCheckState(parent, newItemMap);
            parent.checked = parentState === "checked"; // Only set to true if all children are checked
          }
          current = parent;
        }

        return newData;
      });
    },
    [] // No dependencies, setInternalData is stable
  );

  // Function to filter the tree to show only selected items and their necessary ancestors
  const getFilteredSelectedTree = useCallback(
    (items: TreeViewItem[]): TreeViewItem[] => {
      const filtered: TreeViewItem[] = [];
      const allCurrentCheckedItems = getCheckedItems(internalData); // Get checked items from the current internalData
      const checkedItemIds = new Set(
        allCurrentCheckedItems.map((item) => item.id)
      );

      for (const item of items) {
        const originalItem = itemMap.get(item.id);
        if (!originalItem) continue;

        if (originalItem.children && originalItem.children.length > 0) {
          // It's a folder, recursively filter its children
          const filteredChildren = getFilteredSelectedTree(
            originalItem.children
          );

          // Include folder if it's checked itself OR has any checked descendants
          if (
            checkedItemIds.has(originalItem.id) ||
            filteredChildren.length > 0
          ) {
            filtered.push({
              ...originalItem,
              children: filteredChildren,
              // The checked state for the displayed item should be its original state
              checked: originalItem.checked,
              loaded: true, // Mark as loaded for display purposes in the right tree
            });
          }
        } else {
          // It's a leaf node
          if (checkedItemIds.has(originalItem.id)) {
            filtered.push({ ...originalItem, checked: true, loaded: true }); // Ensure leaf is marked checked if it's selected
          }
        }
      }
      return filtered;
    },
    [getCheckedItems, internalData, itemMap]
  );

  const filteredSelectedData = useMemo(
    () => getFilteredSelectedTree(internalData),
    [internalData, getFilteredSelectedTree]
  );

  // Automatically expand all nodes in the right tree for display
  const [rightTreeExpandedIds, setRightTreeExpandedIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const allFolderIds = (items: TreeViewItem[]): string[] => {
      let ids: string[] = [];
      items.forEach((item) => {
        if (item.children) {
          ids.push(item.id);
          ids = [...ids, ...allFolderIds(item.children)];
        }
      });
      return ids;
    };
    setRightTreeExpandedIds(new Set(allFolderIds(filteredSelectedData)));
  }, [filteredSelectedData]);

  const handleRightTreeToggleExpand = useCallback(
    (id: string, isOpen: boolean) => {
      setRightTreeExpandedIds((prev) => {
        const newExpandedIds = new Set(prev);
        if (isOpen) {
          newExpandedIds.add(id);
        } else {
          newExpandedIds.delete(id);
        }
        return newExpandedIds;
      });
    },
    []
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 gap-8">
      {/* Left Tree: Selection */}
      <TreeView
        data={internalData}
        title="Choose Database Objects"
        showCheckboxes={true}
        searchPlaceholder="Search objects..."
        onCheckChange={handleCheckChange}
        expandedIds={expandedIds}
        onToggleExpand={handleToggleExpand}
        itemMap={itemMap}
        getCheckedItems={getCheckedItems}
        setExpandedIds={setExpandedIds} // Pass setExpandedIds
      />

      {/* Right Tree: Display Selected */}
      <TreeView
        data={filteredSelectedData}
        title="Selected Objects"
        showCheckboxes={false} // Disable checkboxes for display
        showExpandAll={false} // No expand/collapse all buttons for display
        searchPlaceholder="Filter selected objects..." // Can still search within selected
        onCheckChange={() => {}} // No-op for check changes
        expandedIds={rightTreeExpandedIds} // Use separate expanded state for right tree
        onToggleExpand={handleRightTreeToggleExpand} // Use separate toggle for right tree
        itemMap={itemMap} // Still use the original itemMap for path generation
        getCheckedItems={getCheckedItems}
        setExpandedIds={setRightTreeExpandedIds} // Pass setExpandedIds for right tree
      />
    </div>
  );
}
