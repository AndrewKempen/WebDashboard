import React from "react";
import { Button, Classes, Menu, MenuDivider, Position } from "@blueprintjs/core";
import { MenuItem2, Popover2 } from "@blueprintjs/popover2";
import { EntityId } from "@reduxjs/toolkit";

import { useAppDispatch, useAppSelector } from "../Store/hooks";
import {
    selectRoutineIds,
    selectRoutineById,
    addedRoutine,
    deletedRoutine,
    renamedRoutine,
    duplicatedRoutine
} from "./routinesSlice";
import { selectActiveRoutine, selectActiveRoutineId, selectedActiveRoutine } from "../Tree/uiSlice";

import { NameInput } from "./NameInput";
import { DeleteMenuItem, DuplicateMenuItem, EditMenuItem, RenameMenuItem } from "../Tree/MenuItems";
import { DUMMY_ID } from "../Store/storeUtils";

export function RoutineMenu(): JSX.Element {
    const dispatch = useAppDispatch();

    const activeRoutineId = useAppSelector(selectActiveRoutineId);
    const activeRoutineName = useAppSelector(state => {
        return activeRoutineId === DUMMY_ID ? "" : selectActiveRoutine(state).name
    });

    const [isOpen, setIsOpen] = React.useState(false);
    const [globalIsRenaming, setGlobalIsRenaming] = React.useState(false);

    const ownerButton = (activeRoutineId === DUMMY_ID ?
        <Button
            icon="add"
            text={"Add routine"}
            minimal={true}
            onClick={() => dispatch(addedRoutine())}
        /> :
        <Button
            icon="playbook"
            rightIcon="chevron-down"
            text={activeRoutineName}
            minimal={true}
            onClick={() => { setIsOpen(true); }}
        />);

    const addRoutineItem = (
        <MenuItem2
            icon="add"
            text="Add routine"
            onClick={() => { dispatch(addedRoutine()); }}
            shouldDismissPopover={false}
        />);

    const ids = useAppSelector(selectRoutineIds);
    const routineMenu = (
        <Menu className={Classes.ELEVATION_2}>
            {ids.map((id) =>
                <RoutineItem
                    key={id} // key here to make React happy
                    id={id}
                    selected={id === activeRoutineId}
                    setGlobalIsRenaming={setGlobalIsRenaming}
                    setIsOpen={setIsOpen}
                />)}
            <MenuDivider />
            {addRoutineItem}
        </Menu>);

    return (!activeRoutineName ? ownerButton :
        <Popover2
            children={ownerButton}
            content={routineMenu}
            usePortal={true}
            minimal={true}
            position={Position.BOTTOM_LEFT}
            matchTargetWidth={true}
            isOpen={isOpen}
            onClose={() => { setIsOpen(globalIsRenaming); }} // setIsOpen to globalIsRenaming (which is usually false)
        />);
}

interface RoutineItemProps {
    id: EntityId;
    selected: boolean;
    setGlobalIsRenaming: (isRenaming: boolean) => void;
    setIsOpen: (state: boolean) => void;
}

function RoutineItem(props: RoutineItemProps): JSX.Element {
    const dispatch = useAppDispatch();

    const name = useAppSelector(state => selectRoutineById(state, props.id).name);

    const [isRenaming, setIsRenaming] = React.useState(false);
    return isRenaming ? (<NameInput
        initialName={name}
        icon="playbook"
        newNameSubmitted={(newName) => {
            if (newName) { dispatch(renamedRoutine({ newName: newName, id: props.id })); }
            setIsRenaming(false);
            props.setGlobalIsRenaming(false);
        }}
    />) :
        (<MenuItem2
            className={props.selected ? Classes.SELECTED : ""}
            icon="playbook"
            text={name}
            roleStructure="listoption"
            selected={props.selected}
            submenuProps={{ className: Classes.ELEVATION_2 }}
            onClick={() => {
                props.setIsOpen(false);
                dispatch(selectedActiveRoutine(props.id));
            }}
        >
            < RoutineSubmenu
                id={props.id}
                handleRenameClick={() => {
                    setIsRenaming(true);
                    props.setGlobalIsRenaming(true);
                }}
            />
        </MenuItem2>);
}

interface RoutineSubmenuProps {
    id: EntityId;
    handleRenameClick: React.MouseEventHandler;
}

function RoutineSubmenu(props: RoutineSubmenuProps): JSX.Element {
    const dispatch = useAppDispatch();
    const dismissProps = { shouldDismissPopover: false };
    return (<>
        <EditMenuItem onClick={() => dispatch(selectedActiveRoutine(props.id))} />
        <RenameMenuItem {...dismissProps} onClick={props.handleRenameClick} />
        <DuplicateMenuItem {...dismissProps} onClick={() => { dispatch(duplicatedRoutine(props.id)); }} />
        <MenuDivider />
        <DeleteMenuItem {...dismissProps} onClick={() => { dispatch(deletedRoutine(props.id)); }} />
    </>);
}