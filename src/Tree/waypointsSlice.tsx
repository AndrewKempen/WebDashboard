import { createSlice, createEntityAdapter, nanoid, PayloadAction, EntityId, isAnyOf } from "@reduxjs/toolkit";
import undoable from "redux-undo";

import { Point, PointUtils, Units } from "../Field/mathUtils";
import { addedRoutineInternal, deletedRoutineInternal, duplicatedRoutineInternal } from "../Navbar/routinesSlice";
import { AppThunk, RootState } from "../Store/store";
import { deletedFolderInternal } from "./foldersSlice";
import { deletedPathInternal } from "./pathsSlice";
import { selectSelectedWaypointIds } from "./tempUiSlice";
import { getNextName } from "./Utils";

/**
 * @param {number} robotAngle - The angle of the robot at the waypoint in radians.
 *      Should be undefined for tank drives, as the angle is computed automatically/the same as the waypoint angle.
 */
interface WaypointBase {
    id: EntityId;
    name: string;
    robotAngle?: number;
}

/**
 * A waypoint which defines a point the path passes through.
 * 
 * @param {Point} position - The position of the waypoint.
 * @param {number} angle - The angle of the path through the waypoint. Always relative to the world, not the robot.
 * @param {number} endMagnitude - The end magnitude of the path, representing the magnitude of the spline coming into the waypoint. 
 * @param {number} startMagnitude - The start magnitude of the path, representing the magnitude of the spline leaving the waypoint.
 */
export interface ControlWaypoint extends WaypointBase {
    point: Point;
    angle: number;
    endMagnitude: number;
    startMagnitude: number;
}

export function isControlWaypoint(waypoint: Waypoint): waypoint is ControlWaypoint {
    const controlWaypoint = waypoint as ControlWaypoint;
    return controlWaypoint.point !== undefined &&
        controlWaypoint.angle !== undefined &&
        controlWaypoint.endMagnitude !== undefined &&
        // controlWaypoint.flipEnd !== undefined &&
        controlWaypoint.startMagnitude !== undefined;
    // controlWaypoint.flipStart !== undefined;
}

export enum MagnitudePosition {
    START,
    END
}

/**
 * @param {number} parameter - The position of the waypoint relative to the spline defined
 *      by the previous and next control waypoints in the path. Is in the range (0, 1).
 */
export interface FollowerWaypoint extends WaypointBase {
    parameter: number;
}

export function isFollowerWaypoint(waypoint: Waypoint): waypoint is FollowerWaypoint {
    const followerWaypoint = waypoint as FollowerWaypoint;
    return followerWaypoint.parameter !== undefined;
}

export type Waypoint = ControlWaypoint | FollowerWaypoint;

const waypointsAdapter = createEntityAdapter<Waypoint>();
const simpleSelectors = waypointsAdapter.getSelectors();

export const waypointsSlice = createSlice({
    name: "waypoints",
    initialState: waypointsAdapter.getInitialState(),
    reducers: {
        /**
         * @param {number} index @optional
         *      The index to insert at. The existing waypoint at the index is shifted back to make room.
         */
        addedWaypoint: {
            reducer: (waypointState, action: PayloadAction<{
                waypointId: EntityId,
                index?: number
            }>) => {
                waypointsAdapter.addOne(waypointState, {
                    id: action.payload.waypointId,
                    name: getNextName(simpleSelectors.selectAll(waypointState), "Waypoint"),
                    point: {
                        x: 0 * Units.INCH,
                        y: 0 * Units.INCH
                    },
                    angle: 0 * Units.DEGREE,
                    startMagnitude: 1 * Units.FEET,
                    endMagnitude: 1 * Units.FEET
                });
            },
            prepare: (index?: number) => {
                return { payload: { waypointId: nanoid(), index } };
            }
        },
        deletedWaypoint: waypointsAdapter.removeOne,
        changedWaypoint: waypointsAdapter.updateOne,
        waypointMovedInternal: (waypointState, action: PayloadAction<{
            id: EntityId,
            point: Point,
            selectedWaypointIds: EntityId[]
        }>) => {
            const { id, point, selectedWaypointIds } = action.payload;
            const waypoint = simpleSelectors.selectById(waypointState, id);
            if (!waypoint || !isControlWaypoint(waypoint)) { throw new Error("Expected waypoint to be a control waypoint."); }

            const offset = PointUtils.sub(point, waypoint.point);

            const updateObjects = selectedWaypointIds.map((selectedWaypointId) => {
                const waypoint = simpleSelectors.selectById(waypointState, selectedWaypointId);
                if (!waypoint || !isControlWaypoint(waypoint)) { throw new Error("Expected waypoint to be a control waypoint."); }
                const newPoint = PointUtils.add(waypoint.point, offset);
                return { id: selectedWaypointId, changes: { point: newPoint } };
            });
            waypointsAdapter.updateMany(waypointState, updateObjects);
        },
        waypointMagnitudeMoved: (waypointState, action: PayloadAction<{
            id: EntityId,
            point: Point,
            magnitudePosition: MagnitudePosition
        }>) => {
            const { id, point, magnitudePosition } = action.payload;
            const waypoint = simpleSelectors.selectById(waypointState, id);
            if (!waypoint || !isControlWaypoint(waypoint)) { throw new Error("Expected waypoint to be a control waypoint."); }

            const newAngle = Math.atan2(point.y - waypoint.point.y, point.x - waypoint.point.x);
            const newMagnitude = Math.sqrt((point.x - waypoint.point.x) * (point.x - waypoint.point.x) +
                (point.y - waypoint.point.y) * (point.y - waypoint.point.y));
            const changes = (magnitudePosition === MagnitudePosition.START) ?
                // magnitude out
                { angle: newAngle, startMagnitude: newMagnitude } :
                // magnitude in
                { angle: newAngle + 180 * Units.DEGREE, endMagnitude: newMagnitude };
            waypointsAdapter.updateOne(waypointState, { id, changes });
        },
        waypointRobotRotated: (waypointState, action: PayloadAction<{ id: EntityId, point: Point }>) => {
            const { id, point } = action.payload;
            const waypoint = simpleSelectors.selectById(waypointState, id);
            if (!waypoint || !isControlWaypoint(waypoint)) { throw new Error("Expected waypoint to be a control waypoint."); }

            const newAngle = Math.atan2(point.y - waypoint.point.y, point.x - waypoint.point.x);
            waypointsAdapter.updateOne(waypointState, { id: action.payload.id, changes: { robotAngle: newAngle } });
        },
        duplicatedWaypointInternal: (waypointState, action: PayloadAction<{ waypointId: EntityId, newWaypointId: EntityId }>) => {
            const waypoint = simpleSelectors.selectById(waypointState, action.payload.waypointId);
            if (waypoint) {
                let copy = Object.assign({}, waypoint);
                copy.id = action.payload.newWaypointId;
                copy.name = "Copy of " + copy.name;
                if (isControlWaypoint(copy)) {
                    copy.point = {
                        x: copy.point.x + 1 * Units.FEET,
                        y: copy.point.y + 1 * Units.FEET
                    };
                } else { copy.parameter += 0.1; }
                waypointsAdapter.addOne(waypointState, copy);
            }
        },
        renamedWaypoint(waypointState, action: PayloadAction<{ newName: string, id: EntityId }>) {
            waypointsAdapter.updateOne(waypointState, { id: action.payload.id, changes: { name: action.payload.newName } });
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(addedRoutineInternal, (waypointState, action) => {
                let index = 0;
                action.payload.waypointIds.forEach(waypointId => {
                    waypointsAdapter.addOne(waypointState, {
                        id: waypointId,
                        name: getNextName(simpleSelectors.selectAll(waypointState), "Waypoint"),
                        point: {
                            x: (index ? 5 : 1) * Units.FEET,
                            y: (index ? 3 : 1) * Units.FEET
                        },
                        angle: 0 * Units.DEGREE,
                        startMagnitude: 1 * Units.FEET,
                        endMagnitude: 1 * Units.FEET
                    });
                    index++;
                });
            })
            .addCase(duplicatedRoutineInternal, (waypointState, action) => {
                waypointsAdapter.addMany(waypointState, action.payload.waypoints);
            })
            // matchers must come last
            .addMatcher(
                isAnyOf(deletedRoutineInternal, deletedPathInternal, deletedFolderInternal),
                (waypointState, action) => waypointsAdapter.removeMany(waypointState, action.payload.waypointIds))
    }
});

/**
 * Made tricky by the need to insert into the correct location in path.
 * Could currently be a prepare function.
 * In the future, could simply dispatch addedWaypointAfter.
 */
export function duplicatedWaypoint(id: EntityId): AppThunk {
    return (dispatch) =>
        dispatch(duplicatedWaypointInternal({
            waypointId: id,
            newWaypointId: nanoid()
        }));
}

export function waypointMoved(id: EntityId, point: Point): AppThunk {
    return (dispatch, getState) =>
        dispatch(waypointsSlice.actions.waypointMovedInternal({
            id, point,
            selectedWaypointIds: selectSelectedWaypointIds(getState())
        }));
}

export const {
    duplicatedWaypointInternal,
    addedWaypoint,
    deletedWaypoint,
    changedWaypoint,
    renamedWaypoint,
    waypointMagnitudeMoved,
    waypointRobotRotated,
    waypointMovedInternal
} = waypointsSlice.actions;

export const waypointsSliceReducer = undoable(waypointsSlice.reducer);

// Runtime selectors
export const {
    selectById: selectWaypointById,
    selectIds: selectWaypointIds,
    selectAll: selectAllWaypoints,
    selectEntities: selectWaypointDictionary,
} = waypointsAdapter.getSelectors<RootState>((state) => state.history.present.waypoints);