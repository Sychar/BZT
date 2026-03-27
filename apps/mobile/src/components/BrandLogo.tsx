import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type Props = {
  compact?: boolean;
};

export default function BrandLogo({ compact = false }: Props) {
  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      <Text style={[styles.mark, compact && styles.markCompact]}>B·Z·T</Text>
      <View style={styles.frameRow}>
        <View style={styles.frameLeft} />
        <Text style={[styles.subline, compact && styles.sublineCompact]}>bis zum tisch</Text>
        <View style={styles.frameRight} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "center"
  },
  wrapperCompact: {
    minWidth: 136
  },
  mark: {
    color: colors.ink,
    textAlign: "center",
    fontSize: 36,
    letterSpacing: 3,
    fontWeight: "700"
  },
  markCompact: {
    fontSize: 18,
    letterSpacing: 1.2,
    fontWeight: "700"
  },
  frameRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  frameLeft: {
    width: 20,
    height: 20,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: colors.forest,
    marginRight: 6
  },
  frameRight: {
    width: 20,
    height: 20,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: colors.forest,
    marginLeft: 6
  },
  subline: {
    color: colors.brand,
    fontSize: 20,
    fontWeight: "500",
    borderBottomWidth: 2,
    borderColor: colors.forest,
    paddingHorizontal: 8,
    paddingBottom: 4
  },
  sublineCompact: {
    fontSize: 11,
    borderBottomWidth: 1.5,
    paddingHorizontal: 4,
    paddingBottom: 2
  }
});
