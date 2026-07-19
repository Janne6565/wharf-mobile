import { Fragment } from "react";
import { View } from "react-native";
import { Card, RowDivider } from "./Card";
import { SectionLabel } from "./SectionLabel";

interface ListSkeletonProps {
  // Number of placeholder rows (defaults to a typical short list).
  readonly rows?: number;
  readonly testID?: string;
}

// A shimmer-free first-load placeholder for a grouped-list card: N muted bars in
// the MembersSkeleton recipe (circle + flex bar + short bar). A blank SectionLabel
// keeps the vertical rhythm of a real titled section so the card does not jump when
// the loaded content replaces it.
export function ListSkeleton({ rows = 3, testID }: ListSkeletonProps) {
  const rowKeys = Array.from({ length: rows }, (_, index) => `skeleton-row-${index}`);
  return (
    <View className="mt-6" testID={testID}>
      <SectionLabel> </SectionLabel>
      <Card>
        {rowKeys.map((key, index) => (
          <Fragment key={key}>
            {index > 0 ? <RowDivider /> : null}
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="h-7 w-7 rounded-full bg-surface" />
              <View className="h-3.5 flex-1 rounded-full bg-surface" />
              <View className="h-3.5 w-12 rounded-full bg-surface" />
            </View>
          </Fragment>
        ))}
      </Card>
    </View>
  );
}
