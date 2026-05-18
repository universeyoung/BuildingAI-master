"use client";

import { cn } from "@buildingai/ui/lib/utils";
import { CheckIcon, PlusCircleIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "./badge";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Separator } from "./separator";

/**
 * DataTableFacetedFilter 组件属性
 */
export interface DataTableFacetedFilterProps {
  className?: string;
  /** 筛选标题 */
  title?: string;
  /** 可选项 */
  options: {
    /** 展示标签 */
    label: string;
    /** 值 */
    value: string;
    /** 可选图标 */
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  /** 当前选中值 */
  selectedValue?: string;
  /** 选中值变化回调 */
  onSelectionChange: (value: string | undefined) => void;
}

/**
 * 表格分面筛选组件（单选）
 */
export function DataTableFacetedFilter({
  className,
  title,
  options,
  selectedValue,
  onSelectionChange,
}: DataTableFacetedFilterProps) {
  const selectedOption = options.find((option) => option.value === selectedValue);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("border-dashed", className)}>
          <PlusCircleIcon className="mr-2 size-4" />
          {title}
          {selectedValue && selectedOption && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {selectedOption.label}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>未找到结果</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValue === option.value;
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      onSelectionChange(isSelected ? undefined : option.value);
                    }}
                  >
                    <div
                      className={cn(
                        "border-primary mr-2 flex size-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <CheckIcon className="size-4" />
                    </div>
                    {option.icon && <option.icon className="text-muted-foreground mr-2 size-4" />}
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValue && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onSelectionChange(undefined)}
                    className="justify-center text-center"
                  >
                    清除筛选
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
