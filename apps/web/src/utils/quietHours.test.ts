import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getQuietHoursConfig = vi.fn()
vi.mock("./preferences", () => ({ getQuietHoursConfig }))

const { formatStoredTime, formatWorkingHoursRange, currentQuietPeriodStartMs, isInQuietHours } = await import(
    "./quietHours"
)

const atLocalTime = (hms: string) => {
    const [hours, minutes, seconds] = hms.split(":").map(Number)
    const now = new Date()
    now.setHours(hours, minutes, seconds ?? 0, 0)
    return now
}

describe("quietHours", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        getQuietHoursConfig.mockReset()
    })

    describe("isInQuietHours", () => {
        it("is false when no config is set", () => {
            getQuietHoursConfig.mockReturnValue(null)
            expect(isInQuietHours()).toBe(false)
        })

        it("is false during working hours, true outside them", () => {
            getQuietHoursConfig.mockReturnValue({ working_hours_start: "09:00:00", working_hours_end: "18:00:00" })

            vi.setSystemTime(atLocalTime("12:00:00"))
            expect(isInQuietHours()).toBe(false)

            vi.setSystemTime(atLocalTime("20:00:00"))
            expect(isInQuietHours()).toBe(true)
        })

        it("treats the start boundary as working and the end boundary as quiet", () => {
            getQuietHoursConfig.mockReturnValue({ working_hours_start: "09:00:00", working_hours_end: "18:00:00" })

            vi.setSystemTime(atLocalTime("09:00:00"))
            expect(isInQuietHours()).toBe(false)

            vi.setSystemTime(atLocalTime("18:00:00"))
            expect(isInQuietHours()).toBe(true)
        })

        it("handles working hours that wrap midnight", () => {
            getQuietHoursConfig.mockReturnValue({ working_hours_start: "22:00:00", working_hours_end: "06:00:00" })

            vi.setSystemTime(atLocalTime("23:00:00"))
            expect(isInQuietHours()).toBe(false)

            vi.setSystemTime(atLocalTime("02:00:00"))
            expect(isInQuietHours()).toBe(false)

            vi.setSystemTime(atLocalTime("12:00:00"))
            expect(isInQuietHours()).toBe(true)
        })

        it("is false when start and end are equal", () => {
            getQuietHoursConfig.mockReturnValue({ working_hours_start: "09:00:00", working_hours_end: "09:00:00" })
            vi.setSystemTime(atLocalTime("15:00:00"))
            expect(isInQuietHours()).toBe(false)
        })

        it("is false when a bound is unparseable", () => {
            getQuietHoursConfig.mockReturnValue({ working_hours_start: "garbage", working_hours_end: "18:00:00" })
            vi.setSystemTime(atLocalTime("20:00:00"))
            expect(isInQuietHours()).toBe(false)
        })
    })

    describe("currentQuietPeriodStartMs", () => {
        it("is null when no config is set", () => {
            getQuietHoursConfig.mockReturnValue(null)
            expect(currentQuietPeriodStartMs()).toBeNull()
        })

        it("is today's end-of-work when now is after it", () => {
            getQuietHoursConfig.mockReturnValue({ working_hours_start: "09:00:00", working_hours_end: "18:00:00" })
            vi.setSystemTime(atLocalTime("20:00:00"))

            const start = new Date(currentQuietPeriodStartMs()!)
            expect(start.getHours()).toBe(18)
            expect(start.getDate()).toBe(new Date().getDate())
        })

        it("is yesterday's end-of-work when now is before it", () => {
            getQuietHoursConfig.mockReturnValue({ working_hours_start: "09:00:00", working_hours_end: "18:00:00" })
            const reference = atLocalTime("07:00:00")
            vi.setSystemTime(reference)

            const start = new Date(currentQuietPeriodStartMs()!)
            expect(start.getHours()).toBe(18)
            expect(start.getDate()).toBe(reference.getDate() - 1)
        })
    })

    describe("formatStoredTime", () => {
        it("formats in 24-hour and 12-hour form", () => {
            expect(formatStoredTime("9:05:00", "24-hour")).toBe("09:05")
            expect(formatStoredTime("9:05:00", "12-hour")).toBe("9:05 AM")
        })

        it("returns an empty string for missing or unparseable input", () => {
            expect(formatStoredTime(undefined, "24-hour")).toBe("")
            expect(formatStoredTime("not-a-time", "24-hour")).toBe("")
        })
    })

    describe("formatWorkingHoursRange", () => {
        it("is null when not configured", () => {
            getQuietHoursConfig.mockReturnValue(null)
            expect(formatWorkingHoursRange("24-hour")).toBeNull()
        })

        it("formats both bounds together", () => {
            getQuietHoursConfig.mockReturnValue({ working_hours_start: "09:00:00", working_hours_end: "18:00:00" })
            expect(formatWorkingHoursRange("24-hour")).toBe("09:00 – 18:00")
        })
    })
})
