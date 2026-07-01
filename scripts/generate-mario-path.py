import json
import os
import re
import urllib.request
from collections import deque

THEMES = {
    "light": {
        "bg": "#87CEEB",
        "empty": "#ebedf0",
        "lvl1": "#9be9a8",
        "lvl2": "#40c463",
        "lvl3": "#30a14e",
        "lvl4": "#216e39",
        "block_stroke": "#1b1f230d",
        "ground": "#c84c0c",
        "ground_top": "#000000",
        "path": "#f97316",
        "flag_pole": "#000000",
        "flag": "#39d353",
        "castle": "#b85c38",
        "castle_door": "#000000",
        "pipe": "#00A800",
        "text": "#1e293b",
        "cloud": "#FFFFFF",
    },
    "dark": {
        "bg": "#0d1117",
        "empty": "#161b22",
        "lvl1": "#0e4429",
        "lvl2": "#006d32",
        "lvl3": "#26a641",
        "lvl4": "#39d353",
        "block_stroke": "#30363d",
        "ground": "#7c2d12",
        "ground_top": "#21262d",
        "path": "#fb923c",
        "flag_pole": "#8b949e",
        "flag": "#3fb950",
        "castle": "#9a3412",
        "castle_door": "#161b22",
        "pipe": "#238636",
        "text": "#e6edf3",
        "cloud": "#30363d",
    },
}

LEVEL_MAP = {
    "NONE": "empty",
    "FIRST_QUARTILE": "lvl1",
    "SECOND_QUARTILE": "lvl2",
    "THIRD_QUARTILE": "lvl3",
    "FOURTH_QUARTILE": "lvl4",
}


def fetch_contributions(username, token):
    query = """
    query($userName:String!) {
      user(login: $userName){
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionLevel
              }
            }
          }
        }
      }
    }
    """
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": {"userName": username}}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
    return data["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]


def mock_weeks(cols=53, rows=7):
    weeks = []
    for col in range(cols):
        days = []
        for row in range(rows):
            score = (col * 3 + row * 5 + (col // 7) * 2) % 11
            if score <= 2:
                level = "NONE"
            elif score <= 4:
                level = "FIRST_QUARTILE"
            elif score <= 6:
                level = "SECOND_QUARTILE"
            elif score <= 8:
                level = "THIRD_QUARTILE"
            else:
                level = "FOURTH_QUARTILE"
            days.append({"contributionLevel": level})
        weeks.append({"contributionDays": days})
    return weeks


def load_weeks_data():
    weeks_json = os.environ.get("MARIO_WEEKS_JSON")
    if weeks_json and os.path.isfile(weeks_json):
        with open(weeks_json, encoding="utf-8") as f:
            return json.load(f)

    username = os.environ.get("GITHUB_ACTOR", "srinivas600")
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_PAT")
    if token:
        try:
            return fetch_contributions(username, token)
        except Exception as err:
            print(f"Warning: GitHub API failed ({err}); using mock contribution data.")

    print("No contribution JSON — generating Mario parkour with mock contribution data.")
    return mock_weeks()


def draw_sprite(name, pixels, colors, scale):
    lines = [f'<g id="{name}">']
    for y_idx, row_str in enumerate(pixels):
        for x_idx, char in enumerate(row_str):
            if char in colors:
                px = x_idx * scale
                py = y_idx * scale
                lines.append(
                    f'<rect x="{px}" y="{py}" width="{scale}" height="{scale}" fill="{colors[char]}"/>'
                )
    lines.append("</g>")
    return "\n".join(lines)


def cell_center(col, row, grid_x_offset, top_padding, step, cell_size, mario_height):
    cx = grid_x_offset + col * step + cell_size / 2
    cy = top_padding + row * step - mario_height
    return round(cx, 1), round(cy, 1)


def build_walkable_grid(weeks_data):
    grid = []
    levels = []
    for week in weeks_data:
        col_walk = []
        col_lvl = []
        for day in week["contributionDays"]:
            lvl = LEVEL_MAP.get(day.get("contributionLevel", "NONE"), "empty")
            col_lvl.append(lvl)
            col_walk.append(lvl != "empty")
        grid.append(col_walk)
        levels.append(col_lvl)
    return grid, levels


def find_start_cell(grid, cols, rows):
    for c in range(cols):
        walkable = [r for r in range(rows) if grid[c][r]]
        if walkable:
            return c, max(walkable)
    return 0, min(3, rows - 1)


def find_goal_cell(grid, cols, rows):
    for c in range(cols - 1, -1, -1):
        for r in range(rows):
            if grid[c][r]:
                return c, r
    return cols - 1, 0


def maze_neighbors(c, r, grid, cols, rows):
    """4-connected steps on blocks, plus jumps to the next walkable week column."""
    nbrs = []
    for dr in (-1, 1):
        nr = r + dr
        if 0 <= nr < rows and grid[c][nr]:
            nbrs.append((c, nr))
    nc = c + 1
    while nc < cols:
        walkable = [rr for rr in range(rows) if grid[nc][rr]]
        if walkable:
            nbrs.append((nc, min(walkable, key=lambda rr: abs(rr - r))))
            break
        nc += 1
    return nbrs


def bfs_maze_route(grid, cols, rows):
    start = find_start_cell(grid, cols, rows)
    goal = find_goal_cell(grid, cols, rows)

    queue = deque([(start, [start])])
    visited = {start}

    while queue:
        pos, route = queue.popleft()
        if pos == goal:
            return route
        for nbr in maze_neighbors(pos[0], pos[1], grid, cols, rows):
            if nbr not in visited:
                visited.add(nbr)
                queue.append((nbr, route + [nbr]))

    return [start, goal]


def append_manhattan(waypoints, x, y):
    if not waypoints:
        waypoints.append((x, y))
        return
    lx, ly = waypoints[-1]
    if abs(lx - x) < 0.05 and abs(ly - y) < 0.05:
        return
    if abs(lx - x) > 0.05 and abs(ly - y) > 0.05:
        waypoints.append((x, ly))
    if abs(waypoints[-1][0] - x) > 0.05 or abs(waypoints[-1][1] - y) > 0.05:
        waypoints.append((x, y))


def append_segment(waypoints, grid, c1, r1, c2, r2, grid_x_offset, top_padding, step, cell_size, mario_height):
    """Orthogonal steps that only use walkable blocks (no cutting through walls)."""
    x1, y1 = cell_center(c1, r1, grid_x_offset, top_padding, step, cell_size, mario_height)
    x2, y2 = cell_center(c2, r2, grid_x_offset, top_padding, step, cell_size, mario_height)

    if c1 == c2:
        append_manhattan(waypoints, x1, y2)
        return

    gap = c2 - c1
    if gap > 1:
        lx, ly = waypoints[-1] if waypoints else (x1, y1)
        mid_x = round((lx + x2) / 2, 1)
        vault_y = round(min(ly, y2) - 18 - gap * 4, 1)
        append_manhattan(waypoints, mid_x, vault_y)
        append_manhattan(waypoints, x2, y2)
        return

    # Adjacent columns: step via a shared row on walkable blocks when possible
    if grid[c2][r1]:
        xh, yh = cell_center(c2, r1, grid_x_offset, top_padding, step, cell_size, mario_height)
        append_manhattan(waypoints, xh, yh)
        if r2 != r1 and grid[c2][r2]:
            append_manhattan(waypoints, x2, y2)
        return

    if grid[c1][r2]:
        xv, yv = cell_center(c1, r2, grid_x_offset, top_padding, step, cell_size, mario_height)
        append_manhattan(waypoints, xv, yv)
        append_manhattan(waypoints, x2, y2)
        return

    append_manhattan(waypoints, x2, y2)


def route_to_waypoints(route, grid, grid_x_offset, top_padding, step, cell_size, mario_height):
    """Turn BFS grid route into orthogonal pixel waypoints on block tops."""
    waypoints = []
    for i, (col, row) in enumerate(route):
        x, y = cell_center(col, row, grid_x_offset, top_padding, step, cell_size, mario_height)
        if i == 0:
            waypoints.append((x, y))
            continue
        pc, pr = route[i - 1]
        append_segment(
            waypoints, grid, pc, pr, col, row,
            grid_x_offset, top_padding, step, cell_size, mario_height,
        )
    return waypoints


def waypoints_to_path_d(waypoints, pipe_x, ground_y, entry_y, entry_x, flag_x, flag_top, castle_x, mario_height):
    parts = [
        f"M {pipe_x + 4} {ground_y}",
        f"L {pipe_x + 4} {round(entry_y + mario_height * 0.55, 1)}",
        f"L {entry_x} {entry_y}",
    ]
    for x, y in waypoints[1:]:
        parts.append(f"L {x} {y}")

    last_x, last_y = waypoints[-1] if waypoints else (entry_x, entry_y)
    if abs(last_x - (flag_x - 4)) > 0.05:
        parts.append(f"L {flag_x - 4} {last_y}")
    parts.append(f"L {flag_x - 4} {flag_top + 10}")
    parts.append(f"L {flag_x - 4} {round(ground_y - mario_height, 1)}")
    parts.append(f"L {castle_x + 15} {round(ground_y - mario_height, 1)}")
    return " ".join(parts)


def path_progress(path_d):
    """Approximate motion progress (0..1) by x-position along the route."""
    xs = [float(m) for m in re.findall(r"[ML]\s*([-\d.]+)\s+[-\d.]+", path_d)]
    if not xs:
        return lambda _x: 0.0
    x_min, x_max = min(xs), max(xs)
    span = max(1.0, x_max - x_min)

    def progress(x):
        return min(1.0, max(0.0, (x - x_min) / span))

    return progress


def build_maze_path(
    weeks_data,
    grid_x_offset,
    top_padding,
    step,
    cell_size,
    mario_height,
    ground_y,
    pipe_x,
    castle_x,
    flag_x,
):
    cols = len(weeks_data)
    rows = 7
    grid, levels = build_walkable_grid(weeks_data)

    route = bfs_maze_route(grid, cols, rows)
    entry_col, entry_row = route[0]
    entry_x, entry_y = cell_center(
        entry_col, entry_row, grid_x_offset, top_padding, step, cell_size, mario_height
    )

    waypoints = route_to_waypoints(
        route, grid, grid_x_offset, top_padding, step, cell_size, mario_height
    )
    if not waypoints or waypoints[0] != (entry_x, entry_y):
        waypoints.insert(0, (entry_x, entry_y))

    flag_top = top_padding - 10
    path_d = waypoints_to_path_d(
        waypoints, pipe_x, ground_y, entry_y, entry_x, flag_x, flag_top, castle_x, mario_height
    )

    progress = path_progress(path_d)
    coins_to_draw = []
    for col, row in route:
        if levels[col][row] == "lvl4":
            cx, _ = cell_center(col, row, grid_x_offset, top_padding, step, cell_size, mario_height)
            block_y = top_padding + row * step
            coins_to_draw.append(
                {
                    "x": grid_x_offset + col * step,
                    "y": block_y - 12,
                    "t": progress(cx),
                }
            )

    t_flag = progress(flag_x)
    return path_d, coins_to_draw, t_flag


def generate_mario_svg(weeks_data, theme_name, filename):
    theme = THEMES[theme_name]
    cell_size = 10
    gap = 4
    step = cell_size + gap
    cols = len(weeks_data)
    rows = 7

    grid_x_offset = 40
    top_padding = 40
    flag_x = grid_x_offset + cols * step + 15
    castle_x = flag_x + 35
    width = castle_x + 80
    height = top_padding + rows * step + 40
    ground_y = top_padding + rows * step
    pipe_x, pipe_top = 10, ground_y - 30
    mario_height = 14

    path_d, coins_to_draw, t_flag = build_maze_path(
        weeks_data,
        grid_x_offset,
        top_padding,
        step,
        cell_size,
        mario_height,
        ground_y,
        pipe_x,
        castle_x,
        flag_x,
    )

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        "<style>",
        f".bg {{ fill: {theme['bg']}; }}",
        f".empty {{ fill: {theme['empty']}; }}",
        f".lvl1 {{ fill: {theme['lvl1']}; stroke: {theme['block_stroke']}; stroke-width: 0.5; }}",
        f".lvl2 {{ fill: {theme['lvl2']}; stroke: {theme['block_stroke']}; stroke-width: 0.5; }}",
        f".lvl3 {{ fill: {theme['lvl3']}; stroke: {theme['block_stroke']}; stroke-width: 0.5; }}",
        f".lvl4 {{ fill: {theme['lvl4']}; stroke: {theme['block_stroke']}; stroke-width: 0.5; }}",
        f".ground {{ fill: {theme['ground']}; }}",
        f".ground-top {{ fill: {theme['ground_top']}; }}",
        "</style>",
        '<rect class="bg" width="100%" height="100%"/>',
        "<defs>",
    ]

    mario_pixels = [
        " RRRRR ",
        " RRRRRRRRR ",
        " BBSSSO ",
        " BOSSSOOOO ",
        " BOSSSOOOO ",
        " BOOOOO ",
        " RROORR ",
        " RRROORRR ",
        " RRROORRRR ",
        " SSRRRRYSS ",
        " SSS SSS ",
        "BBBB BBBB ",
    ]
    cloud_pixels = [" WWWW ", " WWWWWWWWWW ", " WWWWWWWWWWWWWW ", " WWWWWWWWWWWWWW "]
    bush_pixels = [" GGGG ", " GGGGGGGGGG ", " GGGGGGGGGGGGGG ", " GGGGGGGGGGGGGG "]
    coin_pixels = [" YYYY ", " YYOOYY ", " YOOOOY ", " YOOOOY ", " YYOOYY ", " YYYY "]
    mario_colors = {"R": "#e52521", "S": "#ffcca6", "B": "#8B4513", "O": "#2038ec", "Y": "#f8d820"}

    svg.append(draw_sprite("mario", mario_pixels, mario_colors, 1.2))
    svg.append(draw_sprite("cloud", cloud_pixels, {"W": theme["cloud"]}, 2.0))
    svg.append(draw_sprite("bush", bush_pixels, {"G": theme["pipe"]}, 2.0))
    svg.append(draw_sprite("coin", coin_pixels, {"Y": "#f8d820", "O": "#d8a000"}, 1.2))
    svg.append("</defs>")

    for i in range(4):
        svg.append(f'<use href="#cloud" x="{40 + i * 120}" y="{10 + (i % 2) * 8}"/>')

    svg.append(
        f'<rect x="{pipe_x}" y="{pipe_top}" width="16" height="{ground_y - pipe_top}" fill="{theme["pipe"]}"/>'
    )
    svg.append(f'<rect x="{pipe_x - 2}" y="{pipe_top}" width="20" height="6" fill="{theme["pipe"]}"/>')

    for col, week in enumerate(weeks_data):
        col_x = grid_x_offset + col * step
        for row, day in enumerate(week["contributionDays"]):
            lvl = LEVEL_MAP.get(day.get("contributionLevel", "NONE"), "empty")
            block_y = top_padding + row * step
            svg.append(
                f'<rect class="{lvl}" x="{col_x}" y="{block_y}" width="{cell_size}" '
                f'height="{cell_size}" rx="2" ry="2"/>'
            )

    svg.append(
        f'<path id="mario-path" d="{path_d}" fill="none" stroke="{theme["path"]}" '
        f'stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>'
    )

    for c in coins_to_draw:
        t, t_end = c["t"], min(1.0, c["t"] + 0.03)
        svg.append(
            f'<use href="#coin" x="{c["x"]}" y="{c["y"]}">'
            f'<animate attributeName="opacity" values="1;1;0" keyTimes="0;{t};{t_end}" '
            f'dur="20s" repeatCount="indefinite"/></use>'
        )

    svg.append(
        f'<line x1="{flag_x}" y1="{top_padding - 10}" x2="{flag_x}" y2="{ground_y}" '
        f'stroke="{theme["flag_pole"]}" stroke-width="2"/>'
    )
    svg.append(
        f'<polygon points="{flag_x},{top_padding - 10} {flag_x + 18},{top_padding - 2} '
        f'{flag_x},{top_padding + 6}" fill="{theme["flag"]}"/>'
    )

    svg.append(
        f'<g><animateMotion dur="20s" repeatCount="indefinite" calcMode="linear">'
        f'<mpath href="#mario-path"/></animateMotion>'
        f'<use href="#mario" x="-8" y="-12"/></g>'
    )

    castle_y = ground_y - 40
    svg.append(f'<rect x="{castle_x}" y="{castle_y}" width="50" height="40" fill="{theme["castle"]}"/>')
    svg.append(
        f'<rect x="{castle_x + 18}" y="{castle_y + 20}" width="14" height="20" fill="{theme["castle_door"]}"/>'
    )
    svg.append(
        f'<text x="{width / 2}" y="{height - 8}" text-anchor="middle" font-family="monospace" '
        f'font-size="12" fill="{theme["text"]}" opacity="0">'
        f'<animate attributeName="opacity" values="0;0;1;1;0" '
        f'keyTimes="0;{t_flag};{t_flag + 0.05};0.95;1" dur="20s" repeatCount="indefinite"/>'
        f"LEVEL CLEAR!</text>"
    )
    svg.append(f'<rect class="ground-top" x="0" y="{ground_y}" width="{width}" height="4"/>')
    svg.append(f'<rect class="ground" x="0" y="{ground_y + 4}" width="{width}" height="{height - ground_y - 4}"/>')
    svg.append("</svg>")

    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        f.write("\n".join(svg))
    print(f"Successfully generated {filename}")


def main():
    weeks_data = load_weeks_data()
    out_light = os.environ.get("MARIO_OUTPUT_LIGHT", "mario-contribution.svg")
    out_dark = os.environ.get("MARIO_OUTPUT_DARK", "mario-contribution-dark.svg")
    generate_mario_svg(weeks_data, "light", out_light)
    generate_mario_svg(weeks_data, "dark", out_dark)


if __name__ == "__main__":
    main()
