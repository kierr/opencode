import { describe, expect, test, spyOn } from "bun:test"
import { Session } from "../../src/session"
import { Bus } from "../../src/bus"

describe("Session Events", () => {
  test("should publish session.created event when session is created", async () => {
    // Spy on the Bus.publish method to verify it's called
    const publishSpy = spyOn(Bus, "publish").mockResolvedValue(undefined)
    
    // Create a new session
    const session = await Session.createNext({
      directory: "/tmp/test",
      title: "Test Session"
    })
    
    // Verify that Bus.publish was called
    expect(publishSpy).toHaveBeenCalled()
    
    // Verify that the session.created event was published
    let createdEventPublished = false
    for (const call of publishSpy.mock.calls) {
      const [eventDef, payload] = call
      if (eventDef.type === "session.created" && payload.info.id === session.id) {
        createdEventPublished = true
        break
      }
    }
    
    expect(createdEventPublished).toBe(true)
    
    // Clean up the spy
    publishSpy.mockRestore()
  })
})