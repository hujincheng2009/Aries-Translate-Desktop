import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import React from 'react';

import { cn } from '@/lib/utils';

// Vertical drag-and-drop list of service instance keys.
// `renderItem(key, dragHandleProps)` renders one row; reordering itself stays in the caller's `onDragEnd`.
export default function ServiceDragList({ list, onDragEnd, renderItem }) {
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable
                droppableId='droppable'
                direction='vertical'
            >
                {(provided) => (
                    // The 8px gap between rows is padding inside each draggable (so it moves with the row);
                    // the negative margin removes the trailing gap after the last row. An empty list is hidden
                    // so it does not leave an extra gap in the tab layout.
                    <div
                        className={cn('-mb-2', list?.length === 0 && 'hidden')}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        {list !== null &&
                            list.map((x, i) => (
                                <Draggable
                                    key={x}
                                    draggableId={x}
                                    index={i}
                                >
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className='pb-2'
                                        >
                                            {renderItem(x, provided.dragHandleProps)}
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}
