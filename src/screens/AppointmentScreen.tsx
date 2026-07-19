import React, { useState } from'react';
import { Button, Form, Input, Message } from'semantic-ui-react';
import { Appointment, addAppointment, hasConflict } from '../../services/appointmentService';

interface Props {
    appointments: Appointment[];
    onAdd: (newAppointments: Appointment[]) => void;
}

const AppointmentScreen: React.FC<Props> = ({ appointments, onAdd }) => {
    const [newAppointment, setNewAppointment] = useState<Appointment>({
        id: '',
        title: '',
        start: '',
        end: '',
        recurrence: null,
    });

    const [buffer, setBuffer] = useState<number>(30);
    const [conflict, setConflict] = useState<boolean>(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewAppointment({...newAppointment, [name]: value });
    };

    const handleBufferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBuffer(parseInt(e.target.value, 10));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const updatedAppointments = addAppointment(appointments, newAppointment, buffer);
            onAdd(updatedAppointments);
            setNewAppointment({
                id: '',
                title: '',
                start: '',
                end: '',
                recurrence: null,
            });
            setConflict(false);
        } catch (error) {
            setConflict(true);
        }
    };

    return (
        <Form onSubmit={handleSubmit}>
            <Form.Field>
                <label>Title</label>
                <Input name="title" value={newAppointment.title} onChange={handleChange} />
            </Form.Field>
            <Form.Field>
                <label>Start Time</label>
                <Input type="datetime-local" name="start" value={newAppointment.start} onChange={handleChange} />
            </Form.Field>
            <Form.Field>
                <label>End Time</label>
                <Input type="datetime-local" name="end" value={newAppointment.end} onChange={handleChange} />
            </Form.Field>
            <Form.Field>
                <label>Buffer Time (minutes)</label>
                <Input type="number" value={buffer} onChange={handleBufferChange} />
            </Form.Field>
            <Button type="submit">Add Appointment</Button>
            {conflict && <Message negative>Appointment conflicts with an existing one.</Message>}
        </Form>
    );
};

export default AppointmentScreen;