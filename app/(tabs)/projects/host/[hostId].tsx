// Host detail inside the PROJECTS stack (re-exports the Hosts-tab screen). The
// project flow pushes this copy so router.back() and the native swipe-back gesture
// both pop to the project detail instead of crossing into the Hosts tab's stack.
export { default } from "../../hosts/[hostId]";
