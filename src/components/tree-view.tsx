"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Folder,
  Info,
  Loader2,
  Search,
} from "lucide-react"; // Import Loader2
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

// Moved interfaces to be accessible by both components
export interface TreeViewItem {
  id: string;
  name: string;
  type: string;
  children?: TreeViewItem[];
  checked?: boolean; // Added checked property
  loaded?: boolean; // Indicates if children have been loaded
  loading?: boolean; // Indicates if children are currently loading
}

export interface TreeViewIconMap {
  [key: string]: JSX.Element | undefined;
}

export interface TreeViewMenuItem {
  id: string;
  label: string;
  icon?: JSX.Element;
  action: (items: TreeViewItem[]) => void;
}

export interface TreeViewProps {
  className?: string;
  data: TreeViewItem[]; // Now passed as prop
  title?: string;
  showExpandAll?: boolean;
  showCheckboxes?: boolean;
  checkboxPosition?: "left" | "right";
  searchPlaceholder?: string;
  selectionText?: string;
  getIcon?: (item: TreeViewItem, depth: number) => JSX.Element;
  onSelectionChange?: (selectedItems: TreeViewItem[]) => void; // Now for checked items
  onAction?: (action: string, items: TreeViewItem[]) => void;
  onCheckChange: (item: TreeViewItem, checked: boolean) => void; // Now required prop
  iconMap?: TreeViewIconMap;
  menuItems?: TreeViewMenuItem[];
  expandedIds: Set<string>; // Now required prop
  onToggleExpand: (id: string, isOpen: boolean, item: TreeViewItem) => void; // Now required prop, pass item
  itemMap: Map<string, TreeViewItem>; // Now required prop
  getCheckedItems: (dataToProcess?: TreeViewItem[]) => TreeViewItem[]; // Now required prop
  setExpandedIds: (expandedIds: Set<string>) => void; // Added setExpandedIds prop
}

interface TreeItemProps {
  item: TreeViewItem;
  depth?: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string, isOpen: boolean, item: TreeViewItem) => void; // Pass item
  getIcon?: (item: TreeViewItem, depth: number) => JSX.Element;
  onAction?: (action: string, items: TreeViewItem[]) => void;
  onCheckChange: (item: TreeViewItem, checked: boolean) => void;
  allItems: TreeViewItem[];
  showCheckboxes?: boolean;
  itemMap: Map<string, TreeViewItem>;
  iconMap?: TreeViewIconMap;
  getCheckedItems: (dataToProcess?: TreeViewItem[]) => TreeViewItem[];
}

// Add this default icon map
const defaultIconMap: TreeViewIconMap = {
  file: <Box className="h-4 w-4 text-red-600" />,
  folder: <Folder className="h-4 w-4 text-primary/80" />,
};

// Update the getCheckState function to work bottom-up
// This function is now a helper, not directly part of TreeView component
export const getCheckState = (
  item: TreeViewItem,
  itemMap: Map<string, TreeViewItem>
): "checked" | "unchecked" | "indeterminate" => {
  // Get the original item from the map
  const originalItem = itemMap.get(item.id);
  if (!originalItem) return "unchecked";

  // If it's a leaf node (no children), return its check state
  if (!originalItem.children || originalItem.children.length === 0) {
    return originalItem.checked ? "checked" : "unchecked";
  }

  // Count the check states of immediate children
  let checkedCount = 0;
  let indeterminateCount = 0;
  originalItem.children.forEach((child) => {
    const childState = getCheckState(child, itemMap); // Recursive call
    if (childState === "checked") checkedCount++;
    if (childState === "indeterminate") indeterminateCount++;
  });

  // Calculate parent state based on children states
  const totalChildren = originalItem.children.length;

  // If all children are checked
  if (checkedCount === totalChildren) {
    return "checked";
  }
  // If any child is checked or indeterminate
  if (checkedCount > 0 || indeterminateCount > 0) {
    return "indeterminate";
  }
  // If no children are checked or indeterminate
  return "unchecked";
};

function TreeItem({
  item,
  depth = 0,
  expandedIds,
  onToggleExpand,
  getIcon,
  onAction,
  onCheckChange,
  allItems,
  showCheckboxes,
  itemMap,
  iconMap = defaultIconMap,
  getCheckedItems,
}: TreeItemProps): JSX.Element {
  const isOpen = expandedIds.has(item.id);
  const [regexInput, setRegexInput] = useState("");
  const [regexError, setRegexError] = useState<string | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Only toggle folder expansion on click
    if (item.children) {
      onToggleExpand(item.id, !isOpen, item); // Pass item here
    }
  };

  const handleAction = (action: string) => {
    if (onAction) {
      // Get all checked items, or just this item if none checked
      const checkedItems =
        getCheckedItems().length > 0 ? getCheckedItems() : [item];
      onAction(action, checkedItems);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCheckChange) {
      const currentState = getCheckState(item, itemMap);
      // Toggle between checked and unchecked, treating indeterminate as unchecked
      const newChecked = currentState === "checked" ? false : true;
      onCheckChange(item, newChecked);
    }
  };

  const handleApplyRegex = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent closing popover or triggering item click
    if (!item.children || !onCheckChange) return;

    try {
      const regex = new RegExp(regexInput);
      setRegexError(null);
      item.children.forEach((child) => {
        const shouldBeChecked = regex.test(child.name);
        onCheckChange(child, shouldBeChecked);
      });
      setRegexInput(""); // Clear input after successful application
    } catch (error: any) {
      setRegexError(error.message);
    }
  };

  const renderIcon = () => {
    if (getIcon) {
      return getIcon(item, depth);
    }
    // Use the provided iconMap or fall back to default
    return iconMap[item.type] || iconMap.folder || defaultIconMap.folder;
  };

  const getItemPath = (item: TreeViewItem, items: TreeViewItem[]): string => {
    const path: string[] = [item.name];
    const findParent = (
      currentItem: TreeViewItem,
      allItems: TreeViewItem[]
    ) => {
      for (const potentialParent of allItems) {
        if (
          potentialParent.children?.some((child) => child.id === currentItem.id)
        ) {
          path.unshift(potentialParent.name);
          findParent(potentialParent, allItems);
          break;
        }
        if (potentialParent.children) {
          findParent(currentItem, potentialParent.children);
        }
      }
    };
    findParent(item, items);
    return path.join(" → ");
  };

  const currentCheckState = getCheckState(item, itemMap);

  return (
    <div>
      <div
        data-tree-item
        data-id={item.id}
        data-depth={depth}
        data-folder-closed={item.children && !isOpen}
        className={`select-none cursor-pointer text-foreground px-1 group`}
        style={{ paddingLeft: `${depth * 20}px` }}
        onClick={handleClick}
      >
        <div className="flex items-center h-8">
          {item.children ? (
            <div className="flex items-center gap-2 flex-1">
              <Collapsible
                open={isOpen}
                onOpenChange={(open) => onToggleExpand(item.id, open, item)}
              >
                <CollapsibleTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    {item.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <motion.div
                        initial={false}
                        animate={{ rotate: isOpen ? 90 : 0 }}
                        transition={{ duration: 0.1 }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </motion.div>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
              {showCheckboxes && (
                <div
                  className="relative flex items-center justify-center w-4 h-4 cursor-pointer hover:opacity-80"
                  onClick={handleCheckboxClick}
                >
                  {currentCheckState === "checked" && (
                    <div className="w-4 h-4 border rounded bg-primary border-primary flex items-center justify-center">
                      <svg
                        className="h-3 w-3 text-primary-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                  {currentCheckState === "unchecked" && (
                    <div className="w-4 h-4 border rounded border-input" />
                  )}
                  {currentCheckState === "indeterminate" && (
                    <div className="w-4 h-4 border rounded bg-primary border-primary flex items-center justify-center">
                      <div className="h-0.5 w-2 bg-primary-foreground" />
                    </div>
                  )}
                </div>
              )}
              {renderIcon()}
              <span className="flex-1">{item.name}</span>
              {item.children && item.children.length > 0 && showCheckboxes && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Input
                    placeholder="Regex"
                    value={regexInput}
                    onChange={(e) => {
                      setRegexInput(e.target.value);
                      setRegexError(null);
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent item click
                    onKeyDown={(e) => e.stopPropagation()} // Prevent item click
                    className={cn(
                      "h-7 w-28 text-xs",
                      regexError && "border-red-500"
                    )}
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleApplyRegex}
                    disabled={!regexInput.trim()}
                  >
                    Apply
                  </Button>
                </div>
              )}
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 group-hover:opacity-100 opacity-0 items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">{item.name}</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium">Type:</span>{" "}
                        {item.type.charAt(0).toUpperCase() +
                          item.type.slice(1).replace("_", " ")}
                      </div>
                      <div>
                        <span className="font-medium">ID:</span> {item.id}
                      </div>
                      <div>
                        <span className="font-medium">Location:</span>{" "}
                        {getItemPath(item, allItems)}
                      </div>
                      <div>
                        <span className="font-medium">Items:</span>{" "}
                        {item.children?.length || 0} direct items
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 pl-8 group">
              {showCheckboxes && (
                <div
                  className="relative flex items-center justify-center w-4 h-4 cursor-pointer hover:opacity-80"
                  onClick={handleCheckboxClick}
                >
                  {item.checked ? (
                    <div className="w-4 h-4 border rounded bg-primary border-primary flex items-center justify-center">
                      <svg
                        className="h-3 w-3 text-primary-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-4 h-4 border rounded border-input" />
                  )}
                </div>
              )}
              {renderIcon()}
              <span className="flex-1">{item.name}</span>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 group-hover:opacity-100 opacity-0 items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">{item.name}</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium">Type:</span>{" "}
                        {item.type.charAt(0).toUpperCase() +
                          item.type.slice(1).replace("_", " ")}
                      </div>
                      <div>
                        <span className="font-medium">ID:</span> {item.id}
                      </div>
                      <div>
                        <span className="font-medium">Location:</span>{" "}
                        {getItemPath(item, allItems)}
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          )}
        </div>
        {regexError && (
          <p
            className="text-red-500 text-xs mt-1 ml-10"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {regexError}
          </p>
        )}
      </div>
      {item.children &&
        item.loaded && ( // Only render children if loaded
          <Collapsible
            open={isOpen}
            onOpenChange={(open) => onToggleExpand(item.id, open, item)}
          >
            <AnimatePresence initial={false}>
              {isOpen && (
                <CollapsibleContent forceMount asChild>
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.05 }}
                  >
                    {item.children?.map((child) => (
                      <TreeItem
                        key={child.id}
                        item={child}
                        depth={depth + 1}
                        expandedIds={expandedIds}
                        onToggleExpand={onToggleExpand}
                        getIcon={getIcon}
                        onCheckChange={onCheckChange} // Pass onCheckChange
                        allItems={allItems}
                        showCheckboxes={showCheckboxes}
                        itemMap={itemMap}
                        iconMap={iconMap}
                        getCheckedItems={getCheckedItems}
                      />
                    ))}
                  </motion.div>
                </CollapsibleContent>
              )}
            </AnimatePresence>
          </Collapsible>
        )}
    </div>
  );
}

export default function TreeView({
  className,
  data, // Now a prop
  iconMap,
  searchPlaceholder = "Search...",
  showExpandAll = true,
  showCheckboxes = false,
  getIcon,
  onSelectionChange,
  onAction,
  onCheckChange, // Now a prop
  menuItems,
  expandedIds, // Now a prop
  onToggleExpand, // Now a prop
  itemMap, // Now a prop
  getCheckedItems, // Now a prop
  setExpandedIds, // Added setExpandedIds prop
}: TreeViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const treeRef = useRef<HTMLDivElement>(null);

  // Memoize the search results and expanded IDs
  const { filteredData, searchExpandedIds } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { filteredData: data, searchExpandedIds: new Set<string>() };
    }
    const searchLower = searchQuery.toLowerCase();
    const newExpandedIds = new Set<string>();

    // Helper function to check if an item or its descendants match the search
    const itemMatches = (item: TreeViewItem): boolean => {
      const nameMatches = item.name.toLowerCase().includes(searchLower);
      if (nameMatches) return true;
      if (item.children) {
        return item.children.some((child) => itemMatches(child));
      }
      return false;
    };

    // Helper function to filter tree while keeping parent structure
    const filterTree = (items: TreeViewItem[]): TreeViewItem[] => {
      return items
        .map((item) => {
          if (!item.children) {
            return itemMatches(item) ? item : null;
          }
          const filteredChildren = filterTree(item.children);
          if (filteredChildren.length > 0 || itemMatches(item)) {
            if (item.children) {
              newExpandedIds.add(item.id);
            }
            return {
              ...item,
              children: filteredChildren,
            };
          }
          return null;
        })
        .filter((item): item is TreeViewItem => item !== null);
    };
    return {
      filteredData: filterTree(data),
      searchExpandedIds: newExpandedIds,
    };
  }, [data, searchQuery]);

  // Update expanded IDs when search changes
  useEffect(() => {
    if (searchQuery.trim()) {
      // This is a bit of a hack to trigger re-render for search expanded IDs
      // A more robust solution might involve passing searchExpandedIds directly to TreeItem
      // and letting it manage its own expansion based on search.
      setExpandedIds((prev) => new Set([...prev, ...searchExpandedIds]));
    }
  }, [searchExpandedIds, searchQuery, setExpandedIds]);

  // Function to collect all folder IDs
  const getAllFolderIds = (items: TreeViewItem[]): string[] => {
    let ids: string[] = [];
    items.forEach((item) => {
      if (item.children) {
        ids.push(item.id);
        ids = [...ids, ...getAllFolderIds(item.children)];
      }
    });
    return ids;
  };

  const handleExpandAll = () => {
    getAllFolderIds(data).forEach((id) =>
      onToggleExpand(id, true, itemMap.get(id)!)
    ); // Pass item
  };

  const handleCollapseAll = () => {
    getAllFolderIds(data).forEach((id) =>
      onToggleExpand(id, false, itemMap.get(id)!)
    ); // Pass item
  };

  return (
    <div
      ref={treeRef}
      className="bg-background p-6 rounded-xl border max-w-2xl space-y-4 w-[600px] relative shadow-lg"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="h-10 flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          {showExpandAll && (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-2"
                onClick={handleExpandAll}
              >
                <ChevronDown className="h-4 w-4 mr-1" /> Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-2"
                onClick={handleCollapseAll}
              >
                <ChevronRight className="h-4 w-4 mr-1" /> Collapse All
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <div className={cn("rounded-lg bg-card relative select-none", className)}>
        {filteredData.map((item) => (
          <TreeItem
            key={item.id}
            item={item}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            getIcon={getIcon}
            onCheckChange={onCheckChange} // Pass onCheckChange
            allItems={data} // Pass the original full data for path generation
            showCheckboxes={showCheckboxes}
            itemMap={itemMap}
            iconMap={iconMap}
            getCheckedItems={getCheckedItems}
          />
        ))}
      </div>
    </div>
  );
}
