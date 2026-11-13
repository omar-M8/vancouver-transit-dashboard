import asyncio

import httpx
import streamlit as st

from backend.main import get_active_stops, get_transit_by_station


st.set_page_config(
    page_title="Vancouver Transit Dashboard",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
        .stApp {
            background: #0f1419;
            color: #e8eef2;
        }

        [data-testid="stMetric"] {
            background: #182129;
            border: 1px solid #293640;
            border-radius: 8px;
            padding: 1rem;
        }

        [data-testid="stMetricLabel"] {
            color: #9fb0ba;
        }

        [data-testid="stMetricValue"] {
            color: #f4f8fa;
        }
    </style>
    """,
    unsafe_allow_html=True,
)


def run_async(coroutine):
    """Run an existing backend coroutine from Streamlit's synchronous script."""
    try:
        return asyncio.run(coroutine)
    except (TimeoutError, asyncio.TimeoutError, httpx.TimeoutException):
        st.error("TransLink took too long to respond. Please try again in a moment.")
    except Exception:
        st.error("Unable to load live transit data right now. Please try again.")
    return None


st.title("Vancouver Transit Dashboard")
st.caption("Live TransLink GTFS realtime service data")

with st.spinner("Loading network status..."):
    network_status = run_async(get_active_stops())

if network_status:
    metric_columns = st.columns(4)
    metric_columns[0].metric(
        "Active Broadcasting Stops",
        network_status["active_stops_broadcasting"],
    )
    metric_columns[1].metric(
        "Network Punctuality",
        f'{network_status["network_punctuality"]:.1f}%',
    )
    metric_columns[2].metric(
        "Average System Delay",
        f'{network_status["avg_system_delay_min"]:.1f} min',
    )
    metric_columns[3].metric(
        "Active Fleet Trips",
        network_status["total_active_trips"],
    )
else:
    st.stop()

st.subheader("Station arrivals")
station_id = st.text_input(
    "Station ID",
    value="54483",
    help="Enter a numerical TransLink station or stop ID.",
)

if station_id:
    if not station_id.isdigit():
        st.warning("Enter a numerical Station ID to view arrivals.")
    else:
        with st.spinner(f"Loading arrivals for station {station_id}..."):
            station_data = run_async(get_transit_by_station(station_id))

        if station_data is not None:
            if station_data["estimates"]:
                st.dataframe(
                    station_data["estimates"],
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        "trip_id": "Trip ID",
                        "route_id": "Route ID",
                        "stop_sequences": "Stop Sequence",
                        "delay_seconds": st.column_config.NumberColumn(
                            "Delay (seconds)",
                            format="%d",
                        ),
                    },
                )
            else:
                st.info(f"No live arrival estimates found for station {station_id}.")
