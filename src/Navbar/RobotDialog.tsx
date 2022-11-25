import React, { useCallback } from "react";
import { Menu, Classes, Dialog, FormGroup, NumericInput } from "@blueprintjs/core";

import { useAppDispatch, useAppSelector } from "../Store/hooks";
import { robotDialogClosed, selectRobotDialogId } from "../Tree/tempUiSlice";
import { robotMaxAccelerationChanged, robotMaxVelocityChanged, RobotType, selectRobotById, robotUpdated, robotLengthChanged, robotWidthChanged } from "../Tree/robotsSlice";
import { MenuItem2 } from "@blueprintjs/popover2";
import { assertValid, makeUpdate } from "../Store/storeUtils";
import { INCH } from "../Field/mathUtils";

export function RobotDialog(): JSX.Element {
    const dispatch = useAppDispatch();
    const handleClose = useCallback(() => { dispatch(robotDialogClosed()); }, [dispatch]);

    const robotDialogId = useAppSelector(selectRobotDialogId);
    const robotName = useAppSelector(state => robotDialogId ? assertValid(selectRobotById(state, robotDialogId)).name : "");
    return (
        <Dialog
            title={robotName}
            isOpen={robotDialogId !== undefined}
            onClose={handleClose}
            isCloseButtonShown={true}
        >
            <RobotDialogContents />
        </Dialog>
    );
}

function RobotDialogContents(): JSX.Element | null {
    const dispatch = useAppDispatch();

    // selectRobotById to prevent zombie behavior
    const robot = useAppSelector(state => selectRobotById(state, selectRobotDialogId(state) ?? ""));
    if (!robot) { return null; }

    const isSwerve = (robot.robotType === RobotType.SWERVE);
    return (<>
        <div className={Classes.DIALOG_BODY}>
            <FormGroup label="Robot type" >
                <Menu className="select-menu" >
                    <MenuItem2
                        className={isSwerve ? Classes.SELECTED : ""}
                        roleStructure="listoption"
                        selected={isSwerve}
                        label="Swerve"
                        icon="move"
                        onClick={() => { dispatch(robotUpdated(makeUpdate(robot.id, { robotType: RobotType.SWERVE }))); }}
                    />
                    <MenuItem2
                        className={!isSwerve ? Classes.SELECTED : ""}
                        roleStructure="listoption"
                        selected={!isSwerve}
                        label="Tank"
                        icon="arrows-vertical"
                        onClick={() => { dispatch(robotUpdated(makeUpdate(robot.id, { robotType: RobotType.TANK }))); }}
                    />
                </Menu>
            </FormGroup>

            <FormGroup label="Max velocity">
                <NumericInput
                    max={500}
                    min={1}
                    selectAllOnFocus={true}
                    value={robot.maxVelocity}
                    onValueChange={(value) => { dispatch(robotMaxVelocityChanged({ id: robot.id, value })); }}
                />
            </FormGroup>
            <FormGroup label="Max acceleration">
                <NumericInput
                    max={500}
                    min={1}
                    selectAllOnFocus={true}
                    value={robot.maxAcceleration}
                    onValueChange={(value) => { dispatch(robotMaxAccelerationChanged({ id: robot.id, value })); }}
                />
            </FormGroup>

            <FormGroup label="Length">
                <NumericInput
                    max={18}
                    min={1}
                    selectAllOnFocus={true}
                    allowNumericCharactersOnly = {false}
                    minorStepSize = {0.005}
                    majorStepSize = {1}
                    stepSize = {0.01}
                    defaultValue={robot.length / INCH}
                    onValueChange={(value) => { dispatch(robotLengthChanged({ id: robot.id, value:value * INCH })); }}
                />
            </FormGroup>
            <FormGroup label="Width">
                <NumericInput
                    max={18}
                    min={1}
                    selectAllOnFocus={true}
                    allowNumericCharactersOnly = {false}
                    minorStepSize = {0.005}
                    majorStepSize = {1}
                    stepSize = {0.01}
                    defaultValue={robot.width / INCH}
                    onValueChange={(value) => { dispatch(robotWidthChanged({ id: robot.id, value:value * INCH })); }}
                />
            </FormGroup>
        </div>
        {/* <div className={Classes.DIALOG_FOOTER}>
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                <Button
                    text="Close"
                    onClick={() => { dispatch(robotDialogClosed()); }}
                    intent={Intent.PRIMARY}
                />
            </div>
        </div> */}
    </>);
}
