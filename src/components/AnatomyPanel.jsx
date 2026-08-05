// src/components/AnatomyPanel.jsx
import { useState } from "react";
import Body from "react-muscle-highlighter";
import { secondaryMuscleMap } from "../workoutDatabase";
import "./AnatomyPanel.css";

// 🚀 OPTIMIZATION: Moved outside the component so they are only created once in memory!
const muscleToSlug = {
  Chest: ["chest"],
  Core: ["abs"],
  Obliques: ["obliques"],
  Shoulders: ["deltoids"],
  Biceps: ["biceps"],
  Forearms: ["forearm"],
  Hands: ["hands"],
  Quadriceps: ["quadriceps"],
  Adductors: ["adductors"],
  Tibialis: ["tibialis"],
  Knees: ["knees"],
  Ankles: ["ankles"],
  Feet: ["feet"],
  Head: ["head"],
  Neck: ["neck"],
  Trapezius: ["trapezius"],
  "Upper Back": ["upper-back"],
  Lats: ["upper-back"],
  "Lower Back": ["lower-back"],
  Triceps: ["triceps"],
  Glutes: ["gluteal"],
  Hamstrings: ["hamstring"],
  Calves: ["calves"],
  Hair: ["hair"],
};

const slugToMuscle = {
  abs: "Core",
  adductors: "Adductors",
  ankles: "Ankles",
  biceps: "Biceps",
  calves: "Calves",
  chest: "Chest",
  deltoids: "Shoulders",
  feet: "Feet",
  forearm: "Forearms",
  gluteal: "Glutes",
  hamstring: "Hamstrings",
  hands: "Hands",
  hair: "Hair",
  head: "Head",
  knees: "Knees",
  "lower-back": "Lower Back",
  neck: "Neck",
  obliques: "Obliques",
  quadriceps: "Quadriceps",
  tibialis: "Tibialis",
  trapezius: "Trapezius",
  triceps: "Triceps",
  "upper-back": "Upper Back",
};

export default function AnatomyPanel({
  selectedMuscles,
  onBodyPartClick,
  hoveredMuscle,
  onMuscleHover,
}) {
  const [viewSide, setViewSide] = useState("front");

  const handleComponentClick = (part) => {
    if (!part?.slug) return;
    const coreAppName = slugToMuscle[part.slug];
    if (coreAppName) {
      onBodyPartClick(coreAppName);
    }
  };

  // Build the array of highlights for the 3D model
  let highlightData = [];

  // 1. Paint all selected muscles Gold (#FFB800)
  selectedMuscles.forEach((muscle) => {
    const slugs = muscleToSlug[muscle] || [];
    slugs.forEach((slug) => {
      highlightData.push({ slug, color: "#FFB800" });
    });
  });

  // 2. If a user is hovering over a specific row, highlight that target & its secondaries in Orange (#FF5722)
  if (hoveredMuscle) {
    // Highlight hovered target
    const targetSlugs = muscleToSlug[hoveredMuscle] || [];
    targetSlugs.forEach((slug) => {
      highlightData.push({ slug, color: "#FF5722" });
    });

    // Highlight secondary activation items for that target
    const secondaries = secondaryMuscleMap[hoveredMuscle];
    if (secondaries && secondaries !== "None") {
      secondaries.split(", ").forEach((sec) => {
        // Clean text mapping helper in case names differ slightly
        const secClean = sec.trim();
        const secSlugs = muscleToSlug[secClean] || [];
        secSlugs.forEach((slug) => {
          highlightData.push({ slug, color: "#FF5722" });
        });
      });
    }
  }

  return (
    <div className="anatomy-panel">
      <div className="view-toggle-tabs">
        <button
          className={`tab-btn ${viewSide === "front" ? "active-tab" : ""}`}
          onClick={() => setViewSide("front")}
        >
          Anterior (Front)
        </button>
        <button
          className={`tab-btn ${viewSide === "back" ? "active-tab" : ""}`}
          onClick={() => setViewSide("back")}
        >
          Posterior (Back)
        </button>
      </div>

      <div className="anatomy-container">
        <Body
          data={highlightData}
          onBodyPartPress={handleComponentClick}
          gender="male"
          side={viewSide}
          defaultFill="#e5e7eb"
          defaultStroke="#ffffff"
          defaultStrokeWidth={1.5}
        />
      </div>

      <div className="muscle-info-card">
        <div className="mapping-table-header">
          <p className="primary-label">● Target Group</p>
          <p className="secondary-label">Secondary Activation</p>
        </div>

        <div className="secondary-mapping-list">
          {selectedMuscles.length === 0 ? (
            <span className="empty-tag">
              Select groups above to see correlations
            </span>
          ) : (
            selectedMuscles.map((muscle) => {
              const secondaries = secondaryMuscleMap[muscle];
              const isHovered = hoveredMuscle === muscle;

              return (
                <div
                  key={muscle}
                  className={`mapping-row ${isHovered ? "row-hovered" : ""}`}
                  onMouseEnter={() => onMuscleHover(muscle)}
                  onMouseLeave={() => onMuscleHover(null)}
                >
                  <div>
                    <span className="muscle-tag primary-tag mapping-source">
                      {muscle}
                    </span>
                  </div>

                  <div className="mapping-targets">
                    {!secondaries || secondaries === "None" ? (
                      <span className="empty-tag">-</span>
                    ) : (
                      secondaries.split(", ").map((sec, i) => (
                        <span key={i} className="muscle-tag secondary-tag">
                          {sec}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
