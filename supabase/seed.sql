-- Baseline seed data for local development and fresh project restores.
-- Driver login uses employees.employee_id on the keypad.

INSERT INTO employees (employee_id, name, pin, is_active)
VALUES
	('1234', 'Driver 1234', '1234', TRUE),
	('1001', 'Driver 1001', '1001', TRUE)
ON CONFLICT (employee_id) DO UPDATE
SET
	name = EXCLUDED.name,
	pin = EXCLUDED.pin,
	is_active = EXCLUDED.is_active;

INSERT INTO vehicles (vehicle_number, vehicle_type, is_active)
VALUES
	('BUS-01', 'bus', TRUE),
	('BUS-02', 'bus', TRUE)
ON CONFLICT (vehicle_number) DO UPDATE
SET
	vehicle_type = EXCLUDED.vehicle_type,
	is_active = EXCLUDED.is_active;
