// Terminal inside the PROJECTS stack (re-exports the Hosts-tab screen). Connecting
// from a project-origin host detail pushes this copy so closing the terminal pops
// back to the project detail rather than stranding the user in the Hosts stack.
export { default } from "../hosts/terminal";
